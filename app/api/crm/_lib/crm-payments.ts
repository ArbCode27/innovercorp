import type { SupabaseClient } from "@supabase/supabase-js";

export const CRM_PAYMENT_STATUSES = [
  "EN_PROCESO",
  "APROBADO",
  "RECHAZADO",
  "DUPLICADO",
  "ERROR",
] as const;

export type CrmPaymentStatus = (typeof CRM_PAYMENT_STATUSES)[number];

export const CRM_PAYMENT_SOURCES = [
  "ai",
  "advisor",
  "manual",
  "import",
  "external_api",
] as const;

export type CrmPaymentSource = (typeof CRM_PAYMENT_SOURCES)[number];

export type CrmPayment = {
  id: string;
  client_id: number | null;
  conversation_id: number | null;
  message_id: number | null;
  submitted_by_agent_id: number | null;
  wispro_client_id: string | null;
  client_name: string;
  cedula: string;
  phone_id: string | null;
  amount: number;
  amount_raw: string | null;
  bank: string;
  transaction_code: string;
  payment_date: string;
  comment: string | null;
  status: CrmPaymentStatus;
  source: CrmPaymentSource;
  external_payment_id: string | null;
  external_api_status: number | null;
  external_response: unknown;
  error_message: string | null;
  receipt_media_url: string | null;
  receipt_metadata: Record<string, unknown>;
  created_at: string;
  updated_at: string;
};

export type RecordCrmPaymentInput = {
  clientId?: number | null;
  conversationId?: number | null;
  messageId?: number | null;
  submittedByAgentId?: number | null;
  wisproClientId?: string | null;
  clientName: string;
  cedula: string;
  phoneId?: string | null;
  amount: string | number;
  bank: string;
  transactionCode: string;
  paymentDate?: string | null;
  comment?: string | null;
  status?: CrmPaymentStatus;
  source?: CrmPaymentSource;
  externalPaymentId?: string | null;
  externalApiStatus?: number | null;
  externalResponse?: unknown;
  errorMessage?: string | null;
  receiptMediaUrl?: string | null;
  receiptMetadata?: Record<string, unknown>;
};

const LOG_PREFIX = "[CRM_PAYMENTS]";

const parseAmount = (value: string | number): number | null => {
  if (typeof value === "number") {
    return Number.isFinite(value) && value > 0
      ? Math.round((value + Number.EPSILON) * 100) / 100
      : null;
  }

  let raw = value.trim();
  if (!raw) return null;

  if (raw.includes(",") && raw.includes(".")) {
    raw = raw.replace(/\./g, "").replace(",", ".");
  } else if (raw.includes(",")) {
    raw = raw.replace(",", ".");
  }

  raw = raw.replace(/[^\d.]/g, "");
  const parsed = Number.parseFloat(raw);
  if (!Number.isFinite(parsed) || parsed <= 0) return null;
  return Math.round((parsed + Number.EPSILON) * 100) / 100;
};

const todayInCaracas = () =>
  new Intl.DateTimeFormat("en-CA", {
    timeZone: "America/Caracas",
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  }).format(new Date());

const extractExternalId = (body: unknown): string | null => {
  if (!body || typeof body !== "object" || Array.isArray(body)) return null;
  const row = body as Record<string, unknown>;
  const nested =
    row.data && typeof row.data === "object" && !Array.isArray(row.data)
      ? (row.data as Record<string, unknown>)
      : null;

  const id = nested?.id ?? row.id ?? row.payment_id ?? null;
  const value = String(id || "").trim();
  return value || null;
};

export type ListCrmPaymentsFilters = {
  from?: string | null;
  to?: string | null;
  status?: CrmPaymentStatus | "all" | null;
  bank?: string | null;
  q?: string | null;
  limit?: number;
  offset?: number;
};

export type CrmPaymentStatusCounts = Record<CrmPaymentStatus, number>;

const isIsoDate = (value: string) => /^\d{4}-\d{2}-\d{2}$/.test(value);

const sanitizeSearch = (value: string) =>
  value
    .trim()
    .replace(/[%_,()]/g, " ")
    .replace(/\s+/g, " ")
    .slice(0, 80);

const isCrmPaymentStatus = (value: string): value is CrmPaymentStatus =>
  CRM_PAYMENT_STATUSES.includes(value as CrmPaymentStatus);

export const recordCrmPayment = async (
  supabase: SupabaseClient,
  input: RecordCrmPaymentInput,
): Promise<{ ok: boolean; payment: CrmPayment | null; duplicate: boolean }> => {
  try {
    return await insertCrmPayment(supabase, input);
  } catch (error) {
    console.error(`${LOG_PREFIX} persist_unexpected`, {
      error: error instanceof Error ? error.message : String(error),
    });
    return { ok: false, payment: null, duplicate: false };
  }
};

const insertCrmPayment = async (
  supabase: SupabaseClient,
  input: RecordCrmPaymentInput,
): Promise<{ ok: boolean; payment: CrmPayment | null; duplicate: boolean }> => {
  const amount = parseAmount(input.amount);
  const cedula = String(input.cedula || "").replace(/\D/g, "");
  const bank = String(input.bank || "").trim();
  const transactionCode = String(input.transactionCode || "").replace(/\D/g, "");
  const clientName = String(input.clientName || "").trim();

  if (!amount || !cedula || !bank || !transactionCode || !clientName) {
    console.warn(`${LOG_PREFIX} persist_skipped_invalid`, {
      hasAmount: Boolean(amount),
      hasCedula: Boolean(cedula),
      hasBank: Boolean(bank),
      hasRef: Boolean(transactionCode),
      hasName: Boolean(clientName),
    });
    return { ok: false, payment: null, duplicate: false };
  }

  const payload = {
    client_id: input.clientId ?? null,
    conversation_id: input.conversationId ?? null,
    message_id: input.messageId ?? null,
    submitted_by_agent_id: input.submittedByAgentId ?? null,
    wispro_client_id: input.wisproClientId?.trim() || null,
    client_name: clientName,
    cedula,
    phone_id: input.phoneId?.trim() || null,
    amount,
    amount_raw: String(input.amount),
    bank,
    transaction_code: transactionCode,
    payment_date: input.paymentDate?.slice(0, 10) || todayInCaracas(),
    comment: input.comment?.trim() || null,
    status: input.status || "EN_PROCESO",
    source: input.source || "ai",
    external_payment_id:
      input.externalPaymentId || extractExternalId(input.externalResponse),
    external_api_status: input.externalApiStatus ?? null,
    external_response: input.externalResponse ?? null,
    error_message: input.errorMessage?.trim() || null,
    receipt_media_url: input.receiptMediaUrl || null,
    receipt_metadata: input.receiptMetadata || {},
  };

  const { data, error } = await supabase
    .from("crm_payments")
    .insert(payload)
    .select("*")
    .maybeSingle<CrmPayment>();

  if (!error && data) {
    console.log(`${LOG_PREFIX} persist_ok`, {
      id: data.id,
      cedula,
      transactionCode,
      status: data.status,
      conversationId: data.conversation_id,
    });
    return { ok: true, payment: data, duplicate: false };
  }

  if (error?.code === "23505") {
    console.warn(`${LOG_PREFIX} persist_duplicate`, {
      cedula,
      bank,
      transactionCode,
    });
    return { ok: true, payment: null, duplicate: true };
  }

  console.error(`${LOG_PREFIX} persist_failed`, {
    message: error?.message,
    code: error?.code ?? null,
    cedula,
    transactionCode,
  });
  return { ok: false, payment: null, duplicate: false };
};

const applyListFilters = <T>(
  query: T,
  filters: ListCrmPaymentsFilters,
  options: { includeStatus: boolean },
): T => {
  let next = query as {
    gte: (column: string, value: string) => typeof next;
    lte: (column: string, value: string) => typeof next;
    eq: (column: string, value: string) => typeof next;
    or: (filters: string) => typeof next;
  };

  if (filters.from && isIsoDate(filters.from)) {
    next = next.gte("payment_date", filters.from);
  }
  if (filters.to && isIsoDate(filters.to)) {
    next = next.lte("payment_date", filters.to);
  }
  if (options.includeStatus && filters.status && isCrmPaymentStatus(filters.status)) {
    next = next.eq("status", filters.status);
  }
  if (filters.bank?.trim()) {
    next = next.eq("bank", filters.bank.trim());
  }

  const search = filters.q ? sanitizeSearch(filters.q) : "";
  if (search) {
    next = next.or(`cedula.ilike.%${search}%,client_name.ilike.%${search}%`);
  }

  return next as T;
};

const emptyStatusCounts = (): CrmPaymentStatusCounts => ({
  EN_PROCESO: 0,
  APROBADO: 0,
  RECHAZADO: 0,
  DUPLICADO: 0,
  ERROR: 0,
});

export const listCrmPayments = async (
  supabase: SupabaseClient,
  filters: ListCrmPaymentsFilters,
) => {
  const limit = Math.min(Math.max(filters.limit ?? 50, 1), 200);
  const offset = Math.max(filters.offset ?? 0, 0);

  const listQuery = applyListFilters(
    supabase.from("crm_payments").select("*", { count: "exact" }),
    filters,
    { includeStatus: true },
  );

  const banksQuery = supabase
    .from("crm_payments")
    .select("bank")
    .order("bank", { ascending: true })
    .limit(200);

  const countQueries = CRM_PAYMENT_STATUSES.map((status) =>
    applyListFilters(
      supabase.from("crm_payments").select("id", { count: "exact", head: true }),
      { ...filters, status },
      { includeStatus: true },
    ),
  );

  const [listResult, banksResult, ...countResults] = await Promise.all([
    listQuery
      .order("created_at", { ascending: false })
      .range(offset, offset + limit - 1),
    banksQuery,
    ...countQueries,
  ]);

  if (listResult.error) {
    throw new Error(listResult.error.message);
  }

  const counts = emptyStatusCounts();
  CRM_PAYMENT_STATUSES.forEach((status, index) => {
    const result = countResults[index];
    counts[status] = result?.error ? 0 : (result?.count ?? 0);
  });

  const banks = Array.from(
    new Set(
      (banksResult.data || [])
        .map((row) => String((row as { bank?: string }).bank || "").trim())
        .filter(Boolean),
    ),
  );

  return {
    payments: (listResult.data || []) as CrmPayment[],
    total: listResult.count ?? (listResult.data || []).length,
    counts,
    banks,
    limit,
    offset,
  };
};

const REVIEWABLE_STATUSES: CrmPaymentStatus[] = [
  "EN_PROCESO",
  "APROBADO",
  "RECHAZADO",
];

export const isReviewablePaymentStatus = (
  value: string,
): value is CrmPaymentStatus =>
  REVIEWABLE_STATUSES.includes(value as CrmPaymentStatus);

export const updateCrmPaymentStatus = async (
  supabase: SupabaseClient,
  input: { id: string; status: CrmPaymentStatus },
) => {
  if (!isReviewablePaymentStatus(input.status)) {
    throw new Error("Estado de pago no permitido");
  }

  const { data, error } = await supabase
    .from("crm_payments")
    .update({ status: input.status })
    .eq("id", input.id)
    .select("*")
    .maybeSingle<CrmPayment>();

  if (error) {
    throw new Error(error.message);
  }

  return data;
};
