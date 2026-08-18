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

export type WisproCurrentAccount = {
  id: string;
  balance_amount: number;
  credit_amount: number;
  invoice_balance_amount: number;
  created_at: string | null;
  updated_at: string | null;
};

const extractDataObject = (payload: unknown): Record<string, unknown> | null => {
  if (!payload || typeof payload !== "object") return null;
  const root = payload as { data?: unknown };
  if (!root.data || typeof root.data !== "object" || Array.isArray(root.data)) {
    return null;
  }
  return root.data as Record<string, unknown>;
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

/**
 * Official Wispro source for pending client balance.
 * GET /clients/{uuid}/current_account
 * @see https://doc.cloud.wispro.co/reference/clientsidcurrent_account
 */
export const getClientCurrentAccount = async (
  wisproClientId: string,
): Promise<WisproCurrentAccount> => {
  const clientId = wisproClientId.trim();
  if (!clientId) {
    throw new WisproApiError(
      "wispro_id es requerido para consultar cuenta corriente",
      { status: 400, code: "invalid_response" },
    );
  }

  const payload = await wisproGet(
    `/clients/${encodeURIComponent(clientId)}/current_account`,
    {},
  );

  const row = extractDataObject(payload);
  if (!row) {
    throw new WisproApiError(
      "Wispro no devolvió la cuenta corriente del cliente",
      { status: 502, code: "invalid_response" },
    );
  }

  return {
    id: String(row.id || clientId),
    balance_amount: parseAmount(row.balance_amount),
    credit_amount: parseAmount(row.credit_amount),
    invoice_balance_amount: parseAmount(row.invoice_balance_amount),
    created_at: row.created_at ? String(row.created_at) : null,
    updated_at: row.updated_at ? String(row.updated_at) : null,
  };
};

const wisproPost = async (
  path: string,
  body: Record<string, unknown>,
): Promise<unknown> => {
  const { token, baseUrl } = getWisproConfig();
  const url = `${baseUrl}${path.startsWith("/") ? path : `/${path}`}`;

  let response: Response;
  try {
    response = await fetch(url, {
      method: "POST",
      headers: {
        Accept: "application/json",
        "Content-Type": "application/json",
        Authorization: token,
      },
      body: JSON.stringify(body),
      signal: AbortSignal.timeout(REQUEST_TIMEOUT_MS),
      cache: "no-store",
    });
  } catch (error) {
    console.error(`${LOG_PREFIX} post_failed`, {
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
      console.error(`${LOG_PREFIX} post_invalid_json`, {
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
    console.error(`${LOG_PREFIX} post_unauthorized`, {
      path,
      status: response.status,
    });
    throw new WisproApiError("Wispro rechazó las credenciales de API", {
      status: 502,
      code: "unauthorized",
    });
  }

  if (!response.ok) {
    const message =
      payload &&
      typeof payload === "object" &&
      "message" in payload &&
      typeof (payload as { message?: unknown }).message === "string"
        ? String((payload as { message: string }).message)
        : "No se pudo completar la operación en Wispro";

    console.error(`${LOG_PREFIX} post_upstream_error`, {
      path,
      status: response.status,
      message,
    });
    throw new WisproApiError(message, {
      status: response.status >= 400 && response.status < 600 ? response.status : 502,
      code: "upstream",
    });
  }

  if (payload && typeof payload === "object") {
    const status = Number((payload as { status?: unknown }).status);
    if (Number.isFinite(status) && status >= 400) {
      const message =
        "message" in payload &&
        typeof (payload as { message?: unknown }).message === "string"
          ? String((payload as { message: string }).message)
          : "Wispro no pudo completar la operación";

      console.error(`${LOG_PREFIX} post_body_error`, {
        path,
        status,
        message,
      });
      throw new WisproApiError(message, {
        status,
        code: status === 401 || status === 403 ? "unauthorized" : "upstream",
      });
    }
  }

  return payload;
};

export type WisproContract = {
  id: string;
  public_id: number | null;
  client_id: string | null;
  state: string | null;
  plan_id: string | null;
  created_at: string | null;
  updated_at: string | null;
};

export type WisproPaymentPromise = {
  id: string;
  valid_until: string;
  contract_id: string;
  created_at: string | null;
  updated_at: string | null;
};

export type WisproInvoicingPayment = {
  id: string;
  client_id: string;
  amount: number;
  payment_date: string;
  state: string | null;
  transaction_code: string | null;
  comment: string | null;
  raw: unknown;
};

export type CreateWisproInvoicingPaymentInput = {
  clientId: string;
  amount: number;
  paymentDate: string;
  transactionCode?: string | null;
  comment?: string | null;
};

export type CreatePaymentPromiseResult =
  | {
      ok: true;
      created: true;
      promise: WisproPaymentPromise;
      contract: WisproContract;
      validUntil: string;
    }
  | {
      ok: false;
      created: false;
      reason:
        | "no_contract"
        | "service_active"
        | "upstream"
        | "config"
        | "invalid";
      error: string;
    };

const normalizeContract = (record: unknown): WisproContract | null => {
  if (!record || typeof record !== "object") return null;
  const row = record as Record<string, unknown>;
  const id = String(row.id || "").trim();
  if (!id) return null;

  return {
    id,
    public_id:
      typeof row.public_id === "number"
        ? row.public_id
        : Number.isFinite(Number(row.public_id))
          ? Number(row.public_id)
          : null,
    client_id: row.client_id ? String(row.client_id) : null,
    state: row.state ? String(row.state) : null,
    plan_id: row.plan_id ? String(row.plan_id) : null,
    created_at: row.created_at ? String(row.created_at) : null,
    updated_at: row.updated_at ? String(row.updated_at) : null,
  };
};

const normalizeContractState = (state: string | null | undefined) =>
  String(state || "")
    .trim()
    .toLowerCase();

/**
 * Wispro contract states eligible for payment promises.
 * Only suspended (`disabled`) service should get a temporary reactivation promise.
 * @see https://doc.cloud.wispro.co/reference/contracts
 */
export const PROMISE_ELIGIBLE_CONTRACT_STATES = new Set(["disabled"]);

export const isContractSuspendedForPromise = (
  state: string | null | undefined,
): boolean => PROMISE_ELIGIBLE_CONTRACT_STATES.has(normalizeContractState(state));

const CONTRACT_STATE_PRIORITY: Record<string, number> = {
  enabled: 0,
  alerted: 1,
  degraded: 2,
  disabled: 3,
};

const contractRecency = (contract: WisproContract) =>
  Date.parse(contract.updated_at || contract.created_at || "") || 0;

/** Prefer active/healthier contracts (general CRM use). */
export const resolvePreferredContract = (
  contracts: WisproContract[],
): WisproContract | null => {
  if (!contracts.length) return null;

  return [...contracts].sort((left, right) => {
    const leftPriority =
      CONTRACT_STATE_PRIORITY[normalizeContractState(left.state)] ?? 99;
    const rightPriority =
      CONTRACT_STATE_PRIORITY[normalizeContractState(right.state)] ?? 99;
    if (leftPriority !== rightPriority) return leftPriority - rightPriority;
    return contractRecency(right) - contractRecency(left);
  })[0];
};

/**
 * Pick a suspended contract for payment-promise creation.
 * Newest `disabled` contract wins when several exist.
 */
export const resolveSuspendedContractForPromise = (
  contracts: WisproContract[],
): WisproContract | null => {
  const suspended = contracts.filter((contract) =>
    isContractSuspendedForPromise(contract.state),
  );
  if (!suspended.length) return null;

  return [...suspended].sort(
    (left, right) => contractRecency(right) - contractRecency(left),
  )[0];
};

/** Suspended if any contract is Wispro `disabled`. */
export const resolveServiceSuspended = (contracts: WisproContract[]): boolean =>
  contracts.some((contract) => isContractSuspendedForPromise(contract.state));

/** Prefer suspended contract state for messaging; else preferred active contract. */
export const resolvePrimaryContractState = (
  contracts: WisproContract[],
): string | null => {
  const suspended = resolveSuspendedContractForPromise(contracts);
  if (suspended) {
    return normalizeContractState(suspended.state) || "disabled";
  }
  const preferred = resolvePreferredContract(contracts);
  return preferred ? normalizeContractState(preferred.state) || null : null;
};

export const buildAccountStatusFromService = (input: {
  hasDebt: boolean;
  serviceSuspended: boolean;
}): WisproInvoicingSummary["accountStatus"] => {
  if (input.serviceSuspended) return "Suspendido";
  if (input.hasDebt) return "Con deuda";
  return "Al día";
};

/**
 * Client-facing debt from current_account.balance_amount (Innover business rule).
 * Wispro typically stores a negative balance when the subscriber owes money;
 * a positive balance is credit (no debt to collect).
 */
export const resolveDebtFromCurrentAccount = (
  account: WisproCurrentAccount | null,
): number => {
  const balanceAmount = account?.balance_amount ?? 0;
  if (balanceAmount < 0) {
    return roundMoney(Math.abs(balanceAmount));
  }
  return 0;
};

/**
 * Map current_account.balance_amount → CRM invoicing summary.
 * Optional contracts enrich suspension detection (Wispro contract.state).
 */
export const buildInvoicingSummaryFromCurrentAccount = (
  account: WisproCurrentAccount | null,
  options?: { contracts?: WisproContract[] | null },
): WisproInvoicingSummary => {
  const debt = resolveDebtFromCurrentAccount(account);
  const hasDebt = debt > 0;
  const contracts = options?.contracts ?? [];
  const serviceSuspended = resolveServiceSuspended(contracts);
  const contractState = resolvePrimaryContractState(contracts);

  return {
    debt,
    hasDebt,
    serviceSuspended,
    contractState,
    accountStatus: buildAccountStatusFromService({ hasDebt, serviceSuspended }),
    snapshot: account
      ? {
          invoiceIndex: 0,
          itemIndex: 0,
          gross_amount: debt,
          amount: debt,
        }
      : null,
  };
};

export const listContractsByClientId = async (
  wisproClientId: string,
): Promise<WisproContract[]> => {
  const payload = await wisproGet("/contracts", {
    client_id_eq: wisproClientId.trim(),
  });
  return extractDataRecords(payload)
    .map(normalizeContract)
    .filter((contract): contract is WisproContract => contract !== null);
};

export const listContractsByCedula = async (
  cedula: string,
): Promise<WisproContract[]> => {
  const digits = normalizeDocumentDigits(cedula);
  const candidates = digits
    ? buildVeDocumentCandidates(digits)
    : [cedula.trim()].filter(Boolean);

  if (!candidates.length) return [];

  // Prefer exact input / digits first, then prefixed variants.
  for (const candidate of candidates) {
    const payload = await wisproGet("/contracts", {
      client_national_identification_number_eq: candidate,
    });
    const contracts = extractDataRecords(payload)
      .map(normalizeContract)
      .filter((contract): contract is WisproContract => contract !== null);
    if (contracts.length) return contracts;
  }

  return [];
};

/** Default duration for Wispro payment promises (auto + CRM UI). */
export const DEFAULT_PAYMENT_PROMISE_HOURS = 48;

/** valid_until as YYYY-MM-DD, +hours from now in America/Caracas calendar day. */
export const buildPaymentPromiseValidUntil = (
  hours = DEFAULT_PAYMENT_PROMISE_HOURS,
): string => {
  const now = new Date();
  const target = new Date(now.getTime() + hours * 60 * 60 * 1000);
  // Format in America/Caracas to match ISP local day boundaries.
  const parts = new Intl.DateTimeFormat("en-CA", {
    timeZone: "America/Caracas",
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  }).formatToParts(target);

  const year = parts.find((part) => part.type === "year")?.value;
  const month = parts.find((part) => part.type === "month")?.value;
  const day = parts.find((part) => part.type === "day")?.value;
  if (!year || !month || !day) {
    return target.toISOString().slice(0, 10);
  }
  return `${year}-${month}-${day}`;
};

export const createPaymentPromise = async (
  contractId: string,
  validUntil: string,
): Promise<WisproPaymentPromise> => {
  const payload = await wisproPost(
    `/contracts/${encodeURIComponent(contractId)}/payment_promises`,
    { valid_until: validUntil },
  );

  const records = extractDataRecords(payload);
  const row =
    records[0] && typeof records[0] === "object"
      ? (records[0] as Record<string, unknown>)
      : null;

  const id = String(row?.id || "").trim();
  if (!id) {
    throw new WisproApiError("Wispro no devolvió la promesa de pago", {
      status: 502,
      code: "invalid_response",
    });
  }

  return {
    id,
    valid_until: String(row?.valid_until || validUntil),
    contract_id: String(row?.contract_id || contractId),
    created_at: row?.created_at ? String(row.created_at) : null,
    updated_at: row?.updated_at ? String(row.updated_at) : null,
  };
};

const toWisproPaymentDate = (value: string) => {
  const dateOnly = value.slice(0, 10);
  if (/^\d{4}-\d{2}-\d{2}$/.test(dateOnly)) {
    return `${dateOnly}T12:00:00-04:00`;
  }
  return new Date().toISOString();
};

/**
 * POST /invoicing/payments.
 * Without invoice_ids, Wispro credits the amount to the client's current account.
 */
export const createWisproInvoicingPayment = async (
  input: CreateWisproInvoicingPaymentInput,
): Promise<WisproInvoicingPayment> => {
  const clientId = input.clientId.trim();
  if (!clientId) {
    throw new WisproApiError("El cliente Wispro es requerido", {
      status: 400,
      code: "invalid_response",
    });
  }

  if (!Number.isFinite(input.amount) || input.amount <= 0) {
    throw new WisproApiError("El monto del pago no es válido", {
      status: 400,
      code: "invalid_response",
    });
  }

  const payload = await wisproPost("/invoicing/payments", {
    client_id: clientId,
    amount: roundMoney(input.amount),
    payment_date: toWisproPaymentDate(input.paymentDate),
    transaction_code: input.transactionCode?.trim() || undefined,
    comment: input.comment?.trim() || undefined,
  });

  const records = extractDataRecords(payload);
  const row =
    records[0] && typeof records[0] === "object"
      ? (records[0] as Record<string, unknown>)
      : null;

  const id = String(row?.id || "").trim();
  if (!id) {
    throw new WisproApiError("Wispro no devolvió el pago creado", {
      status: 502,
      code: "invalid_response",
    });
  }

  return {
    id,
    client_id: String(row?.client_id || clientId),
    amount: parseAmount(row?.amount ?? input.amount),
    payment_date: String(row?.payment_date || input.paymentDate),
    state: row?.state ? String(row.state) : null,
    transaction_code: row?.transaction_code
      ? String(row.transaction_code)
      : input.transactionCode?.trim() || null,
    comment: row?.comment ? String(row.comment) : input.comment?.trim() || null,
    raw: payload,
  };
};

/**
 * Resolve contract + create a payment promise. Never throws for business skips;
 * throws only unexpected programmer issues — callers should catch WisproApiError.
 */
export const createPaymentPromiseForClient = async (input: {
  wisproClientId?: string | null;
  cedula?: string | null;
  hours?: number;
}): Promise<CreatePaymentPromiseResult> => {
  const hours =
    input.hours && input.hours > 0 ? input.hours : DEFAULT_PAYMENT_PROMISE_HOURS;
  const wisproClientId = input.wisproClientId?.trim() || "";
  const cedula = input.cedula?.trim() || "";

  if (!wisproClientId && !cedula) {
    return {
      ok: false,
      created: false,
      reason: "invalid",
      error: "Se requiere wispro_id o cédula",
    };
  }

  try {
    let contracts: WisproContract[] = [];
    if (wisproClientId) {
      contracts = await listContractsByClientId(wisproClientId);
    }
    if (!contracts.length && cedula) {
      contracts = await listContractsByCedula(cedula);
    }

    if (!contracts.length) {
      console.warn(`${LOG_PREFIX} promise_skipped_no_contract`, {
        wisproClientId: wisproClientId || null,
        cedula: cedula || null,
      });
      return {
        ok: false,
        created: false,
        reason: "no_contract",
        error: "No se encontró un contrato Wispro para este cliente",
      };
    }

    // Only create promises when service is suspended (disabled). Active = skip.
    const contract = resolveSuspendedContractForPromise(contracts);
    if (!contract) {
      const states = contracts.map((item) => normalizeContractState(item.state) || "unknown");
      console.warn(`${LOG_PREFIX} promise_skipped_service_active`, {
        wisproClientId: wisproClientId || null,
        cedula: cedula || null,
        contractStates: states,
        preferredActiveId: resolvePreferredContract(contracts)?.id ?? null,
      });
      return {
        ok: false,
        created: false,
        reason: "service_active",
        error:
          "No se creó la promesa: el servicio del cliente está activo (no suspendido).",
      };
    }

    const validUntil = buildPaymentPromiseValidUntil(hours);
    const promise = await createPaymentPromise(contract.id, validUntil);

    console.log(`${LOG_PREFIX} promise_created`, {
      promiseId: promise.id,
      contractId: contract.id,
      contractState: normalizeContractState(contract.state),
      validUntil,
      sourceClientId: wisproClientId || null,
    });

    return {
      ok: true,
      created: true,
      promise,
      contract,
      validUntil,
    };
  } catch (error) {
    const message =
      error instanceof WisproApiError
        ? error.message
        : error instanceof Error
          ? error.message
          : "No se pudo crear la promesa de pago";

    console.error(`${LOG_PREFIX} promise_failed`, {
      wisproClientId: wisproClientId || null,
      cedula: cedula || null,
      error: message,
    });

    return {
      ok: false,
      created: false,
      reason:
        error instanceof WisproApiError && error.code === "config"
          ? "config"
          : "upstream",
      error: message,
    };
  }
};

/**
 * Live debt + suspension for a Wispro client UUID.
 * Debt from current_account; suspension from contracts (soft-fail).
 */
export const fetchInvoicingForWisproClientId = async (
  wisproClientId: string,
): Promise<{
  account: WisproCurrentAccount;
  contracts: WisproContract[];
  invoicing: WisproInvoicingSummary;
}> => {
  const wisproId = wisproClientId.trim();
  if (!wisproId) {
    throw new WisproApiError("wispro_id es requerido", {
      status: 400,
      code: "invalid_response",
    });
  }

  const [accountResult, contractsResult] = await Promise.allSettled([
    getClientCurrentAccount(wisproId),
    listContractsByClientId(wisproId),
  ]);

  if (accountResult.status === "rejected") {
    throw accountResult.reason;
  }

  const account = accountResult.value;
  let contracts: WisproContract[] = [];

  if (contractsResult.status === "fulfilled") {
    contracts = contractsResult.value;
  } else {
    // Soft-fail: never invent suspension when contracts lookup fails.
    console.warn(`${LOG_PREFIX} contracts_lookup_failed`, {
      wisproId,
      error:
        contractsResult.reason instanceof Error
          ? contractsResult.reason.message
          : String(contractsResult.reason),
    });
  }

  const invoicing = buildInvoicingSummaryFromCurrentAccount(account, {
    contracts,
  });

  console.log(`${LOG_PREFIX} current_account_ok`, {
    wisproId,
    balanceAmount: account.balance_amount,
    invoiceBalance: account.invoice_balance_amount,
    credit: account.credit_amount,
    debt: invoicing.debt,
    debtSource: "balance_amount",
    serviceSuspended: invoicing.serviceSuspended,
    contractState: invoicing.contractState,
    contractsCount: contracts.length,
  });

  return { account, contracts, invoicing };
};

/** Venezuelan document letter prefixes commonly stored in Wispro. */
const VE_DOCUMENT_PREFIXES = ["V", "E", "J", "G"] as const;

/** Digits only (cédula/RIF without letter). Empty if too short/long after strip. */
export const normalizeDocumentDigits = (raw: string): string =>
  String(raw || "").replace(/\D/g, "");

/**
 * Exact Wispro `_eq` candidates for a numeric document.
 * Order: bare digits first, then V/E/J/G + digits (no hyphens).
 */
export const buildVeDocumentCandidates = (digits: string): string[] => {
  const normalized = normalizeDocumentDigits(digits);
  if (!normalized) return [];

  const candidates = [
    normalized,
    ...VE_DOCUMENT_PREFIXES.map((prefix) => `${prefix}${normalized}`),
  ];

  return [...new Set(candidates)];
};

const lookupClientsByNationalIdExact = async (
  document: string,
  fallbackDigits: string,
): Promise<WisproCustomer[]> => {
  const clientsPayload = await wisproGet("/clients", {
    national_identification_number_eq: document,
  });

  return extractDataRecords(clientsPayload)
    .map((record) => normalizeWisproCustomer(record, fallbackDigits))
    .filter((customer): customer is WisproCustomer => customer !== null);
};

/**
 * Search Wispro by cédula or RIF using digits only.
 * Expands VE prefixes (V/E/J/G) when the bare number has no exact match.
 */
export const searchWisproByCedula = async (
  cedula: string,
): Promise<WisproSearchResult[]> => {
  const digits = normalizeDocumentDigits(cedula);
  if (!digits) {
    console.log(`${LOG_PREFIX} search_ok`, {
      query: cedula.trim() || null,
      digits: null,
      clients: 0,
      reason: "empty_digits",
    });
    return [];
  }

  const candidates = buildVeDocumentCandidates(digits);
  const customersById = new Map<string, WisproCustomer>();
  let matchedCandidate: string | null = null;

  // 1) Prefer exact digits (natural-person cédula without letter).
  try {
    const exactMatches = await lookupClientsByNationalIdExact(digits, digits);
    for (const customer of exactMatches) {
      customersById.set(customer.id, customer);
    }
    if (exactMatches.length) {
      matchedCandidate = digits;
    }
  } catch (error) {
    console.warn(`${LOG_PREFIX} search_candidate_failed`, {
      candidate: digits,
      error: error instanceof Error ? error.message : String(error),
    });
    throw error;
  }

  // 2) If empty, try V/E/J/G in parallel (RIF / prefixed cédula in Wispro).
  if (!customersById.size) {
    const prefixed = candidates.filter((candidate) => candidate !== digits);
    const settled = await Promise.allSettled(
      prefixed.map(async (candidate) => ({
        candidate,
        customers: await lookupClientsByNationalIdExact(candidate, digits),
      })),
    );

    for (const result of settled) {
      if (result.status === "rejected") {
        console.warn(`${LOG_PREFIX} search_candidate_failed`, {
          error:
            result.reason instanceof Error
              ? result.reason.message
              : String(result.reason),
        });
        continue;
      }

      const { candidate, customers } = result.value;
      if (!customers.length) continue;

      if (!matchedCandidate) matchedCandidate = candidate;
      for (const customer of customers) {
        customersById.set(customer.id, customer);
      }
    }
  }

  const customers = [...customersById.values()];

  if (!customers.length) {
    console.log(`${LOG_PREFIX} search_ok`, {
      digits,
      candidatesTried: candidates,
      clients: 0,
    });
    return [];
  }

  const results = await Promise.all(
    customers.map(async (customer) => {
      const { invoicing } = await fetchInvoicingForWisproClientId(customer.id);
      return { customer, invoicing };
    }),
  );

  console.log(`${LOG_PREFIX} search_ok`, {
    digits,
    matchedCandidate,
    clients: results.length,
    withDebt: results.filter((result) => result.invoicing.hasDebt).length,
    suspended: results.filter((result) => result.invoicing.serviceSuspended)
      .length,
  });

  return results;
};
