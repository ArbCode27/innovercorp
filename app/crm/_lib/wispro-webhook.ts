import type {
  WisproCustomer,
  WisproInvoicingSummary,
  WisproSearchResult,
} from "./types";

export interface WisproWebhookSection {
  data?: unknown[];
  meta?: { object?: string; [key: string]: unknown };
  status?: number;
}

/** Webhook Make/Wispro: `{ client, envoicing }` o legacy `{ data: [...] }`. */
export interface WisproWebhookResponse {
  client?: WisproWebhookSection;
  envoicing?: WisproWebhookSection;
  data?: unknown[];
}

const readString = (
  record: Record<string, unknown>,
  keys: string[],
): string | null => {
  for (const key of keys) {
    const value = record[key];

    if (typeof value === "string") {
      const trimmed = value.trim();
      if (trimmed) return trimmed;
    }

    if (typeof value === "number" && !Number.isNaN(value)) {
      return String(value);
    }
  }

  return null;
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

const extractSectionRecords = (
  section: WisproWebhookSection | undefined,
  sectionName: string,
): unknown[] => {
  if (section == null) return [];

  const { status, data } = section;

  if (status != null && status !== 200) {
    console.warn(`[Wispro webhook] ${sectionName}.status no exitoso:`, status);
    return [];
  }

  return Array.isArray(data) ? data : [];
};

export const extractClientRecords = (proxyData: unknown): unknown[] => {
  if (!proxyData || typeof proxyData !== "object") return [];

  const root = proxyData as WisproWebhookResponse;

  if (root.client != null) {
    return extractSectionRecords(root.client, "client");
  }

  if (Array.isArray(root.data)) return root.data;

  return [];
};

export const extractInvoicingRecords = (proxyData: unknown): unknown[] => {
  if (!proxyData || typeof proxyData !== "object") return [];

  const root = proxyData as WisproWebhookResponse;
  return extractSectionRecords(root.envoicing, "envoicing");
};

export const normalizeWisproCustomer = (
  raw: unknown,
  fallbackCedula?: string,
): WisproCustomer | null => {
  if (!raw || typeof raw !== "object") return null;

  const record = raw as Record<string, unknown>;
  const id = readString(record, ["id", "client_id", "wispro_id", "contract_id"]);
  const name = readString(record, ["name", "client_name"]);
  const nationalId =
    readString(record, [
      "national_identification_number",
      "client_national_identification_number",
      "national_id",
      "cedula",
      "document_number",
    ]) ?? fallbackCedula?.trim() ?? "";

  if (!id || !name || !nationalId) {
    console.warn("[Wispro webhook] registro de cliente incompleto:", raw);
    return null;
  }

  return {
    id,
    name,
    national_identification_number: nationalId,
    phone_mobile: readString(record, [
      "phone_mobile",
      "client_phone",
      "phone",
      "mobile",
    ]),
    zone_name: readString(record, ["zone_name", "zone"]),
    city: readString(record, ["city"]),
    state: readString(record, ["state"]),
  };
};

export const parseInvoicingDebt = (
  proxyData: unknown,
): WisproInvoicingSummary => {
  const invoices = extractInvoicingRecords(proxyData);

  if (!invoices.length) {
    return {
      debt: 0,
      hasDebt: false,
      accountStatus: "Al día",
      snapshot: null,
    };
  }

  const invoice = invoices[0];

  if (!invoice || typeof invoice !== "object") {
    return {
      debt: 0,
      hasDebt: false,
      accountStatus: "Al día",
      snapshot: null,
    };
  }

  const invoiceRecord = invoice as Record<string, unknown>;
  const items = Array.isArray(invoiceRecord.items) ? invoiceRecord.items : [];

  if (!items.length) {
    console.warn("[Wispro webhook] factura sin items en envoicing.data[0]");
    return {
      debt: 0,
      hasDebt: false,
      accountStatus: "Al día",
      snapshot: null,
    };
  }

  const item = items[0];

  if (!item || typeof item !== "object") {
    return {
      debt: 0,
      hasDebt: false,
      accountStatus: "Al día",
      snapshot: null,
    };
  }

  const itemRecord = item as Record<string, unknown>;
  const grossAmount = parseAmount(itemRecord.gross_amount);
  const amount = parseAmount(itemRecord.amount);
  const debt = roundMoney(grossAmount + amount);

  return {
    debt,
    hasDebt: debt > 0,
    accountStatus: debt > 0 ? "Con deuda" : "Al día",
    snapshot: {
      invoiceIndex: 0,
      itemIndex: 0,
      gross_amount: grossAmount,
      amount,
    },
  };
};

export const serializeInvoicingForDb = (
  invoicing: WisproInvoicingSummary,
): string | null => {
  if (!invoicing.hasDebt && invoicing.debt <= 0) {
    return null;
  }

  return JSON.stringify({
    debt: invoicing.debt,
    hasDebt: invoicing.hasDebt,
    calculatedAt: new Date().toISOString(),
    source: invoicing.snapshot,
  });
};

export const parseWisproCustomers = (
  proxyData: unknown,
  options?: { fallbackCedula?: string },
): WisproCustomer[] => {
  return extractClientRecords(proxyData)
    .map((record) =>
      normalizeWisproCustomer(record, options?.fallbackCedula),
    )
    .filter((customer): customer is WisproCustomer => customer !== null);
};

export const parseWisproSearchResults = (
  proxyData: unknown,
  options?: { fallbackCedula?: string },
): WisproSearchResult[] => {
  const invoicing = parseInvoicingDebt(proxyData);
  let customers = parseWisproCustomers(proxyData, options);

  if (!customers.length) {
    customers = extractInvoicingRecords(proxyData)
      .map((record) =>
        normalizeWisproCustomer(record, options?.fallbackCedula),
      )
      .filter((customer): customer is WisproCustomer => customer !== null);
  }

  return customers.map((customer) => ({
    customer,
    invoicing,
  }));
};
