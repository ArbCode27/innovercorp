export const PLAN_ROUND_USD = 0.15;

export type PaymentAmountKind =
  | "pending"
  | "exact"
  | "partial"
  | "rounded"
  | "credit";

export type PaymentAmountComparison = {
  paid: number;
  expected: number | null;
  displayPaid: number;
  remaining: number;
  credit: number;
  rounded: boolean;
  kind: PaymentAmountKind;
};

export const roundMoney = (value: number) =>
  Math.round((value + Number.EPSILON) * 100) / 100;

const toPositiveMoney = (value: number | null | undefined): number | null => {
  if (value === null || value === undefined) return null;
  const amount = Number(value);
  if (!Number.isFinite(amount) || amount <= 0) return null;
  return roundMoney(amount);
};

/**
 * Compare a receipt amount to the single pending invoice.
 * Shortfall ≤ $0.15 rounds up to the invoice. Overpay > $0.15 is credit.
 */
export const comparePaymentToExpected = (
  paid: number | null | undefined,
  expected: number | null | undefined,
): PaymentAmountComparison | null => {
  const paidAmount = toPositiveMoney(paid);
  if (paidAmount == null) return null;

  const expectedAmount = toPositiveMoney(expected);
  if (expectedAmount == null) {
    return {
      paid: paidAmount,
      expected: null,
      displayPaid: paidAmount,
      remaining: 0,
      credit: 0,
      rounded: false,
      kind: "pending",
    };
  }

  const shortfall = roundMoney(expectedAmount - paidAmount);

  if (shortfall > 0 && shortfall <= PLAN_ROUND_USD) {
    return {
      paid: paidAmount,
      expected: expectedAmount,
      displayPaid: expectedAmount,
      remaining: 0,
      credit: 0,
      rounded: true,
      kind: "rounded",
    };
  }

  if (shortfall > PLAN_ROUND_USD) {
    return {
      paid: paidAmount,
      expected: expectedAmount,
      displayPaid: paidAmount,
      remaining: shortfall,
      credit: 0,
      rounded: false,
      kind: "partial",
    };
  }

  const overpay = roundMoney(paidAmount - expectedAmount);
  if (overpay > PLAN_ROUND_USD) {
    return {
      paid: paidAmount,
      expected: expectedAmount,
      displayPaid: paidAmount,
      remaining: 0,
      credit: overpay,
      rounded: false,
      kind: "credit",
    };
  }

  return {
    paid: paidAmount,
    expected: expectedAmount,
    displayPaid: paidAmount,
    remaining: 0,
    credit: 0,
    rounded: false,
    kind: "exact",
  };
};

/** Amount to POST to Wispro: rounded invoice when within $0.15, else the receipt. */
export const resolvePaymentPostAmount = (
  comparison: PaymentAmountComparison | null,
): number | null => {
  if (!comparison) return null;
  if (comparison.rounded && comparison.expected != null) {
    return comparison.expected;
  }
  return comparison.paid;
};
