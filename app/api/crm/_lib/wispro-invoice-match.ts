/**
 * Single pending invoice ↔ payment amount matching for Wispro approval.
 * Innover never stacks invoices: one open invoice per client.
 */

import {
  comparePaymentToExpected,
  resolvePaymentPostAmount,
  roundMoney,
} from "@/app/crm/_lib/payment-amount-compare";

export type WisproInvoiceBalance = {
  id: string;
  balance: number;
  amount: number;
  issuedAt: string | null;
  firstDueDate: string | null;
  invoiceNumber: string | null;
  state: string | null;
};

export type InvoiceMatchStrategy =
  | "exact_one"
  | "single_rounded"
  | "single_partial"
  | "single_overpay"
  | "none";

export type InvoiceMatchResult = {
  invoiceIds: string[];
  strategy: InvoiceMatchStrategy;
  matchedAmount: number;
  unmatchedAmount: number;
  postAmount: number;
  expectedAmount: number | null;
  remaining: number;
  credit: number;
  rounded: boolean;
  extraInvoiceCount: number;
  invoices: Array<{
    id: string;
    balance: number;
    invoiceNumber: string | null;
  }>;
};

const OPEN_BALANCE_EPS = 0.01;

const invoiceRecencyKey = (invoice: WisproInvoiceBalance) =>
  Date.parse(invoice.firstDueDate || invoice.issuedAt || "") || 0;

/** Newest open invoice wins if Wispro unexpectedly returns more than one. */
export const pickSinglePendingInvoice = (
  invoices: WisproInvoiceBalance[],
): { invoice: WisproInvoiceBalance | null; extraCount: number } => {
  const open = invoices.filter(
    (invoice) =>
      invoice.id &&
      Number.isFinite(invoice.balance) &&
      invoice.balance > OPEN_BALANCE_EPS,
  );

  if (!open.length) {
    return { invoice: null, extraCount: 0 };
  }

  const sorted = [...open].sort((left, right) => {
    const rightKey = invoiceRecencyKey(right);
    const leftKey = invoiceRecencyKey(left);
    if (rightKey !== leftKey) return rightKey - leftKey;
    return right.id.localeCompare(left.id);
  });

  return {
    invoice: sorted[0] ?? null,
    extraCount: Math.max(0, sorted.length - 1),
  };
};

const strategyForKind = (
  kind: NonNullable<ReturnType<typeof comparePaymentToExpected>>["kind"],
): InvoiceMatchStrategy => {
  if (kind === "rounded") return "single_rounded";
  if (kind === "partial") return "single_partial";
  if (kind === "credit") return "single_overpay";
  if (kind === "exact") return "exact_one";
  return "none";
};

/**
 * Pick the single pending invoice and compare it to the receipt amount.
 * When there is no invoice, `fallbackExpected` (plan price) is used to round.
 */
export const matchInvoicesToPaymentAmount = (
  invoices: WisproInvoiceBalance[],
  paymentAmount: number,
  options?: { fallbackExpected?: number | null },
): InvoiceMatchResult => {
  const amount = roundMoney(paymentAmount);
  const { invoice, extraCount } = pickSinglePendingInvoice(invoices);

  const empty = (): InvoiceMatchResult => ({
    invoiceIds: [],
    strategy: "none",
    matchedAmount: 0,
    unmatchedAmount: Number.isFinite(amount) ? amount : 0,
    postAmount: Number.isFinite(amount) ? amount : 0,
    expectedAmount: null,
    remaining: 0,
    credit: 0,
    rounded: false,
    extraInvoiceCount: extraCount,
    invoices: [],
  });

  if (!Number.isFinite(amount) || amount <= 0) {
    return empty();
  }

  if (!invoice) {
    const fallback = roundMoney(Number(options?.fallbackExpected));
    if (!Number.isFinite(fallback) || fallback <= 0) return empty();

    const comparison = comparePaymentToExpected(amount, fallback);
    const postAmount = resolvePaymentPostAmount(comparison) ?? amount;
    return {
      invoiceIds: [],
      strategy: strategyForKind(comparison?.kind || "none"),
      matchedAmount: 0,
      unmatchedAmount: comparison?.credit ?? 0,
      postAmount,
      expectedAmount: fallback,
      remaining: comparison?.remaining ?? 0,
      credit: comparison?.credit ?? 0,
      rounded: Boolean(comparison?.rounded),
      extraInvoiceCount: extraCount,
      invoices: [],
    };
  }

  if (extraCount > 0) {
    console.warn("[WISPRO_INVOICE_MATCH] extra_pending_invoices_ignored", {
      keptInvoiceId: invoice.id,
      extraCount,
    });
  }

  const comparison = comparePaymentToExpected(amount, invoice.balance);
  const postAmount = resolvePaymentPostAmount(comparison) ?? amount;

  return {
    invoiceIds: [invoice.id],
    strategy: strategyForKind(comparison?.kind || "none"),
    matchedAmount: roundMoney(
      Math.min(postAmount, roundMoney(invoice.balance)),
    ),
    unmatchedAmount: comparison?.credit ?? 0,
    postAmount,
    expectedAmount: roundMoney(invoice.balance),
    remaining: comparison?.remaining ?? 0,
    credit: comparison?.credit ?? 0,
    rounded: Boolean(comparison?.rounded),
    extraInvoiceCount: extraCount,
    invoices: [
      {
        id: invoice.id,
        balance: invoice.balance,
        invoiceNumber: invoice.invoiceNumber,
      },
    ],
  };
};
