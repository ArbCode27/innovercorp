import { comparePaymentToExpected, roundMoney } from "./payment-amount-compare";

export const CRM_PAYMENT_STATUSES = [
  "RECIBIDO",
  "EN_PROCESO",
  "APROBADO",
  "RECHAZADO",
  "DUPLICADO",
  "ERROR",
] as const;

export type CrmPaymentStatus = (typeof CRM_PAYMENT_STATUSES)[number];

export const CRM_PAYMENT_STATUS_LABELS: Record<CrmPaymentStatus, string> = {
  RECIBIDO: "Recibido",
  EN_PROCESO: "En proceso",
  APROBADO: "Aprobado",
  RECHAZADO: "Rechazado",
  DUPLICADO: "Duplicado",
  ERROR: "Error",
};

export const PAYMENT_PENDING_LABEL = "Pendiente";

export const CRM_KNOWN_PAYMENT_BANKS = [
  "Bancamiga",
  "Banplus",
  "Binance",
  "Tarjeta de Débito",
  "Zelle",
  "PayPal",
] as const;

export type PaymentDateType = "payment" | "approval";

export type CrmPayment = {
  id: string;
  client_id: number | null;
  conversation_id: number | null;
  message_id: number | null;
  submitted_by_agent_id: number | null;
  wispro_client_id: string | null;
  client_name: string | null;
  cedula: string | null;
  phone_id: string | null;
  amount: number | null;
  amount_raw: string | null;
  bank: string | null;
  transaction_code: string | null;
  payment_date: string;
  comment: string | null;
  status: CrmPaymentStatus;
  source: string;
  external_payment_id: string | null;
  external_api_status: number | null;
  error_message: string | null;
  receipt_media_url: string | null;
  receipt_metadata?: Record<string, unknown> | null;
  /** ISO timestamp when the payment was approved, when available. */
  approved_at?: string | null;
  /** Most recent pending Wispro invoice date (YYYY-MM-DD), when available. */
  latest_invoice_date?: string | null;
  /** Balance of the single pending Wispro invoice, or plan price when none. */
  expected_amount?: number | null;
  /** Commercial Wispro plan price for the preferred contract. */
  plan_amount?: number | null;
  created_at: string;
  updated_at: string;
};

export type CrmPaymentStatusCounts = Record<CrmPaymentStatus, number>;

export type CrmPaymentBankStat = {
  bank: string;
  totalPayments: number;
  totalAmount: number;
  approvedCount: number;
  approvedAmount: number;
  inProcessCount: number;
  inProcessAmount: number;
};

export type CrmPaymentsListResponse = {
  ok: true;
  payments: CrmPayment[];
  total: number;
  counts: CrmPaymentStatusCounts;
  banks: string[];
  bankStats?: CrmPaymentBankStat[];
  limit: number;
  offset: number;
};

/**
 * Normalizes payment bank names to Innover's registered collection accounts (receptors).
 * When receipts mention both a sending and receiving bank (e.g. "Banesco a Bancamiga"),
 * extracts only the receiving account.
 */
export const normalizeReceptorBank = (
  raw: string | null | undefined,
): string | null => {
  if (!raw) return null;
  const text = raw.trim();
  if (!text) return null;

  const lower = text.toLowerCase();

  // If there's an explicit destination pattern (e.g. "hacia Bancamiga", "destino: Binance", "a Banplus")
  const destinationMatch = lower.match(
    /(?:destino|receptor|hacia|beneficiario|acreditad[oa]\s+en|\ba\b|->)\s*:?\s*(?:el\s+)?(?:banco\s+|método\s+|metodo\s+)?([a-záéíóúñ0-9\s]+)/i,
  );
  const targetSegment = destinationMatch ? destinationMatch[1] : lower;

  if (targetSegment.includes("bancamiga") || targetSegment.includes("amiga")) return "Bancamiga";
  if (targetSegment.includes("banplus")) return "Banplus";
  if (targetSegment.includes("binance") || targetSegment.includes("usdt")) return "Binance";
  if (
    targetSegment.includes("tarjeta") ||
    targetSegment.includes("debito") ||
    targetSegment.includes("débito") ||
    targetSegment.includes("debido") ||
    targetSegment.includes("punto de venta") ||
    targetSegment.includes("pos")
  ) {
    return "Tarjeta de Débito";
  }
  if (targetSegment.includes("zelle")) return "Zelle";
  if (targetSegment.includes("paypal")) return "PayPal";

  // Check known registered receptor banks anywhere in text (prioritizing company receiving banks):
  if (lower.includes("bancamiga") || lower.includes("amiga")) return "Bancamiga";
  if (lower.includes("banplus")) return "Banplus";
  if (lower.includes("binance") || lower.includes("usdt")) return "Binance";
  if (
    lower.includes("tarjeta") ||
    lower.includes("debito") ||
    lower.includes("débito") ||
    lower.includes("debido") ||
    lower.includes("punto de venta") ||
    lower.includes("pos")
  ) {
    return "Tarjeta de Débito";
  }
  if (lower.includes("zelle")) return "Zelle";
  if (lower.includes("paypal")) return "PayPal";

  // If no known bank matched but an explicit destination phrase exists, extract and format it:
  if (destinationMatch && destinationMatch[1]) {
    const cleaned = destinationMatch[1]
      .replace(/^(el\s+|de\s+|del\s+)+/i, "")
      .trim()
      .split(/[,;\n.]/)[0]
      .trim();
    if (cleaned.length >= 2) {
      return cleaned.charAt(0).toUpperCase() + cleaned.slice(1);
    }
  }

  return text;
};

const isExcludedFromAnalytics = (bank: string): boolean => {
  const lower = bank.toLowerCase();
  return (
    lower.includes("venezuela") ||
    lower === "bdv" ||
    lower.includes("banco de venezuela")
  );
};

/**
 * Aggregates payment statistics per bank/account.
 * Always seeds known collection accounts (Bancamiga, Banplus, Binance, Tarjeta de Débito, Zelle, PayPal).
 */
export const buildPaymentBankStats = (
  rows: Array<{
    bank: string | null;
    amount: number | null;
    status: CrmPaymentStatus;
  }>,
): CrmPaymentBankStat[] => {
  const map = new Map<string, CrmPaymentBankStat>();

  for (const knownBank of CRM_KNOWN_PAYMENT_BANKS) {
    map.set(knownBank, {
      bank: knownBank,
      totalPayments: 0,
      totalAmount: 0,
      approvedCount: 0,
      approvedAmount: 0,
      inProcessCount: 0,
      inProcessAmount: 0,
    });
  }

  for (const row of rows) {
    const normalized = normalizeReceptorBank(row.bank);
    if (!normalized) continue;
    // Discard Banco de Venezuela (not used as collection channel)
    if (isExcludedFromAnalytics(normalized)) continue;

    let stat = map.get(normalized);
    if (!stat) {
      stat = {
        bank: normalized,
        totalPayments: 0,
        totalAmount: 0,
        approvedCount: 0,
        approvedAmount: 0,
        inProcessCount: 0,
        inProcessAmount: 0,
      };
      map.set(normalized, stat);
    }

    const amount = Number(row.amount);
    const validAmount = Number.isFinite(amount) && amount > 0 ? amount : 0;

    stat.totalPayments += 1;
    stat.totalAmount = roundMoney(stat.totalAmount + validAmount);

    if (row.status === "APROBADO") {
      stat.approvedCount += 1;
      stat.approvedAmount = roundMoney(stat.approvedAmount + validAmount);
    } else if (row.status === "EN_PROCESO" || row.status === "RECIBIDO") {
      stat.inProcessCount += 1;
      stat.inProcessAmount = roundMoney(stat.inProcessAmount + validAmount);
    }
  }

  const knownSet = new Set<string>(CRM_KNOWN_PAYMENT_BANKS);
  return Array.from(map.values()).sort((a, b) => {
    const aKnown = knownSet.has(a.bank);
    const bKnown = knownSet.has(b.bank);
    if (aKnown && bKnown) {
      return (
        CRM_KNOWN_PAYMENT_BANKS.indexOf(
          a.bank as (typeof CRM_KNOWN_PAYMENT_BANKS)[number],
        ) -
        CRM_KNOWN_PAYMENT_BANKS.indexOf(
          b.bank as (typeof CRM_KNOWN_PAYMENT_BANKS)[number],
        )
      );
    }
    if (aKnown) return -1;
    if (bKnown) return 1;
    return a.bank.localeCompare(b.bank);
  });
};

const digitsOnly = (value: string | null | undefined) =>
  String(value || "").replace(/\D/g, "");

export const formatPaymentField = (value: string | number | null | undefined) => {
  if (value === null || value === undefined) return PAYMENT_PENDING_LABEL;
  const text = String(value).trim();
  return text || PAYMENT_PENDING_LABEL;
};

export const formatPaymentAmount = (amount: number | null | undefined) => {
  if (amount === null || amount === undefined || !Number.isFinite(Number(amount))) {
    return PAYMENT_PENDING_LABEL;
  }

  return new Intl.NumberFormat("es-VE", {
    style: "currency",
    currency: "USD",
    minimumFractionDigits: 2,
  }).format(Number(amount));
};

export const formatPlanAmountLabel = (
  amount: number | null | undefined,
): string => {
  const value = Number(amount);
  if (!Number.isFinite(value) || value <= 0) return "—";
  const rounded = roundMoney(value);
  const body = Number.isInteger(rounded) ? String(rounded) : rounded.toFixed(2);
  return `Plan ${body}$`;
};

export type PaymentAmountDisplay = {
  primary: string;
  secondary: string | null;
  tone: "remaining" | "credit" | null;
};

export const formatPaymentAmountDisplay = (
  paid: number | null | undefined,
  expected: number | null | undefined,
): PaymentAmountDisplay => {
  const comparison = comparePaymentToExpected(paid, expected);
  if (!comparison) {
    return { primary: PAYMENT_PENDING_LABEL, secondary: null, tone: null };
  }

  const primary = formatPaymentAmount(comparison.displayPaid);
  if (comparison.remaining > 0) {
    return {
      primary,
      secondary: `restante ${formatPaymentAmount(comparison.remaining)}`,
      tone: "remaining",
    };
  }
  if (comparison.credit > 0) {
    return {
      primary,
      secondary: `saldo a favor ${formatPaymentAmount(comparison.credit)}`,
      tone: "credit",
    };
  }
  return { primary, secondary: null, tone: null };
};

export const isPaymentReadyForApproval = (payment: {
  status: CrmPaymentStatus;
  wispro_client_id: string | null;
  cedula: string | null;
  bank: string | null;
  transaction_code: string | null;
  amount: number | null;
}) => {
  if (payment.status !== "EN_PROCESO" && payment.status !== "ERROR") {
    return false;
  }

  const rawRef = String(payment.transaction_code || "").trim();
  const hasValidRef = digitsOnly(rawRef).length > 0 || rawRef.length >= 3;

  return Boolean(
    payment.wispro_client_id?.trim() &&
      digitsOnly(payment.cedula) &&
      String(payment.bank || "").trim() &&
      hasValidRef &&
      Number(payment.amount) > 0,
  );
};

export const isPaymentReadyForManualApproval = (payment: {
  status: CrmPaymentStatus;
  amount: number | null;
}) => {
  if (payment.status !== "EN_PROCESO" && payment.status !== "ERROR") {
    return false;
  }
  const amount = Number(payment.amount);
  return Number.isFinite(amount) && amount > 0;
};

export const canRejectPayment = (payment: { status: CrmPaymentStatus }) =>
  payment.status === "RECIBIDO" ||
  payment.status === "EN_PROCESO" ||
  payment.status === "ERROR";

export const formatPaymentDate = (value: string) => {
  const dateOnly = value.slice(0, 10);
  const [year, month, day] = dateOnly.split("-").map(Number);
  if (!year || !month || !day) return value;

  return new Intl.DateTimeFormat("es-VE", {
    timeZone: "America/Caracas",
    day: "2-digit",
    month: "short",
    year: "numeric",
  }).format(new Date(Date.UTC(year, month - 1, day, 12)));
};

export const formatPaymentDateTime = (value: string) =>
  new Intl.DateTimeFormat("es-VE", {
    timeZone: "America/Caracas",
    day: "2-digit",
    month: "short",
    hour: "2-digit",
    minute: "2-digit",
  }).format(new Date(value));

/**
 * Resolves the date and time when a payment was approved.
 * Inspects explicit `approved_at`, receipt_metadata keys, and falls back to
 * `updated_at` / `created_at` for historic approved payments.
 */
export const getPaymentApprovedAt = (
  payment:
    | {
        status?: CrmPaymentStatus | string | null;
        approved_at?: string | null;
        receipt_metadata?: Record<string, unknown> | null;
        updated_at?: string;
        created_at?: string;
      }
    | null
    | undefined,
): string | null => {
  if (!payment || payment.status !== "APROBADO") return null;

  if (typeof payment.approved_at === "string" && payment.approved_at.trim()) {
    return payment.approved_at.trim();
  }

  const meta = payment.receipt_metadata;
  if (meta && typeof meta === "object") {
    if (typeof meta.approved_at === "string" && meta.approved_at.trim()) {
      return meta.approved_at.trim();
    }
    if (
      typeof meta.manual_approved_at === "string" &&
      meta.manual_approved_at.trim()
    ) {
      return meta.manual_approved_at.trim();
    }
    const wisproPayment = meta.wispro_payment as
      | Record<string, unknown>
      | undefined;
    if (
      wisproPayment &&
      typeof wisproPayment.registered_at === "string" &&
      wisproPayment.registered_at.trim()
    ) {
      return wisproPayment.registered_at.trim();
    }
    if (
      meta.registered_in_wispro &&
      typeof meta.registered_at === "string" &&
      meta.registered_at.trim()
    ) {
      return meta.registered_at.trim();
    }
  }

  if (typeof payment.updated_at === "string" && payment.updated_at.trim()) {
    return payment.updated_at.trim();
  }

  if (typeof payment.created_at === "string" && payment.created_at.trim()) {
    return payment.created_at.trim();
  }

  return null;
};

