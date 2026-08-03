import { normalizeWisproCustomer } from "@/app/crm/_lib/wispro-webhook";
import type {
  WisproCustomer,
  WisproInvoicingSummary,
  WisproSearchResult,
} from "@/app/crm/_lib/types";

const LOG_PREFIX = "[WISPRO_API]";
const DEFAULT_BASE_URL = "https://www.cloud.wispro.co/api/v1";
const REQUEST_TIMEOUT_MS = 10_000;

export class WisproApiError extends Error {
  readonly status: number;
  readonly code: "config" | "upstream" | "unauthorized" | "invalid_response";

  constructor(
    message: string,
    options: {
      status: number;
      code: WisproApiError["code"];
      cause?: unknown;
    },
  ) {
    super(message, options.cause ? { cause: options.cause } : undefined);
    this.name = "WisproApiError";
    this.status = options.status;
    this.code = options.code;
  }
}

const getWisproConfig = () => {
  const token = process.env.WISPRO_API_TOKEN?.trim();
  if (!token) {
    throw new WisproApiError(
      "WISPRO_API_TOKEN no está configurado en el servidor",
      { status: 503, code: "config" },
    );
  }

  const baseUrl = (
    process.env.WISPRO_API_BASE_URL?.trim() || DEFAULT_BASE_URL
  ).replace(/\/+$/, "");

  return { token, baseUrl };
};

const parseAmount = (value: unknown): number => {
  if (typeof value === "number" && !Number.isNaN(value)) {
    return value;
  }

  if (typeof value === "string") {
    const parsed = Number.parseFloat(value.trim());
    return Number.isNaN(parsed) ? 0 : parsed;
  }

  return 0;
};

const roundMoney = (value: number) =>
  Math.round((value + Number.EPSILON) * 100) / 100;

const extractDataRecords = (payload: unknown): unknown[] => {
  if (!payload || typeof payload !== "object") return [];

  const root = payload as { data?: unknown; status?: number };
  if (Array.isArray(root.data)) return root.data;
  if (root.data && typeof root.data === "object") return [root.data];
  return [];
};

const invoiceOutstandingAmount = (invoice: Record<string, unknown>) => {
  const balance = parseAmount(invoice.balance);
  if (balance > 0) return balance;

  const amount = parseAmount(invoice.amount);
  if (amount > 0) return amount;

  return parseAmount(invoice.gross_amount);
};

export const buildInvoicingSummaryFromInvoices = (
  invoices: unknown[],
): WisproInvoicingSummary => {
  if (!invoices.length) {
    return {
      debt: 0,
      hasDebt: false,
      accountStatus: "Al día",
      snapshot: null,
    };
  }

  let totalDebt = 0;
  let snapshotGross = 0;
  let snapshotAmount = 0;

  invoices.forEach((invoice, index) => {
    if (!invoice || typeof invoice !== "object") return;

    const record = invoice as Record<string, unknown>;
    totalDebt += invoiceOutstandingAmount(record);

    if (index !== 0) return;

    const items = Array.isArray(record.items) ? record.items : [];
    const firstItem =
      items[0] && typeof items[0] === "object"
        ? (items[0] as Record<string, unknown>)
        : null;

    if (firstItem) {
      snapshotGross = parseAmount(firstItem.gross_amount);
      snapshotAmount = parseAmount(firstItem.amount);
      return;
    }

    snapshotGross = parseAmount(record.gross_amount);
    snapshotAmount = parseAmount(record.amount);
  });

  const debt = roundMoney(totalDebt);

  return {
    debt,
    hasDebt: debt > 0,
    accountStatus: debt > 0 ? "Con deuda" : "Al día",
    snapshot: {
      invoiceIndex: 0,
      itemIndex: 0,
      gross_amount: snapshotGross,
      amount: snapshotAmount,
    },
  };
};

const wisproGet = async (
  path: string,
  query: Record<string, string>,
): Promise<unknown> => {
  const { token, baseUrl } = getWisproConfig();
  const url = new URL(`${baseUrl}${path.startsWith("/") ? path : `/${path}`}`);

  for (const [key, value] of Object.entries(query)) {
    url.searchParams.set(key, value);
  }

  let response: Response;
  try {
    response = await fetch(url, {
      method: "GET",
      headers: {
        Accept: "application/json",
        Authorization: token,
      },
      signal: AbortSignal.timeout(REQUEST_TIMEOUT_MS),
      cache: "no-store",
    });
  } catch (error) {
    console.error(`${LOG_PREFIX} request_failed`, {
      path,
      error: error instanceof Error ? error.message : error,
    });
    throw new WisproApiError("No se pudo conectar con Wispro", {
      status: 502,
      code: "upstream",
      cause: error,
    });
  }

  const rawBody = await response.text();
  let payload: unknown = null;

  if (rawBody) {
    try {
      payload = JSON.parse(rawBody);
    } catch {
      console.error(`${LOG_PREFIX} invalid_json`, {
        path,
        status: response.status,
      });
      throw new WisproApiError("La respuesta de Wispro no es válida", {
        status: 502,
        code: "invalid_response",
      });
    }
  }

  if (response.status === 401 || response.status === 403) {
    console.error(`${LOG_PREFIX} unauthorized`, { path, status: response.status });
    throw new WisproApiError("Wispro rechazó las credenciales de API", {
      status: 502,
      code: "unauthorized",
    });
  }

  if (!response.ok) {
    console.error(`${LOG_PREFIX} upstream_error`, {
      path,
      status: response.status,
    });
    throw new WisproApiError("No se pudo consultar Wispro. Intenta de nuevo.", {
      status: 502,
      code: "upstream",
    });
  }

  return payload;
};

export const searchWisproByCedula = async (
  cedula: string,
): Promise<WisproSearchResult[]> => {
  const normalizedCedula = cedula.trim();

  const [clientsPayload, invoicesPayload] = await Promise.all([
    wisproGet("/clients", {
      national_identification_number_eq: normalizedCedula,
    }),
    wisproGet("/invoicing/invoices", {
      client_national_identification_number_eq: normalizedCedula,
      state_eq: "pending",
    }),
  ]);

  const customers = extractDataRecords(clientsPayload)
    .map((record) => normalizeWisproCustomer(record, normalizedCedula))
    .filter((customer): customer is WisproCustomer => customer !== null);

  const invoicing = buildInvoicingSummaryFromInvoices(
    extractDataRecords(invoicesPayload),
  );

  console.log(`${LOG_PREFIX} search_ok`, {
    cedula: normalizedCedula,
    clients: customers.length,
    hasDebt: invoicing.hasDebt,
    debt: invoicing.debt,
  });

  return customers.map((customer) => ({
    customer,
    invoicing,
  }));
};
