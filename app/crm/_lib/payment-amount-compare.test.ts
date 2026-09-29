import { describe, expect, it } from "vitest";
import {
  comparePaymentToExpected,
  resolveComparisonExpected,
  resolvePaymentPostAmount,
} from "./payment-amount-compare";

describe("comparePaymentToExpected", () => {
  it("returns null when the receipt has no amount", () => {
    expect(comparePaymentToExpected(null, 30)).toBeNull();
    expect(comparePaymentToExpected(0, 30)).toBeNull();
  });

  it("shows only the paid amount when there is no expected invoice", () => {
    const comparison = comparePaymentToExpected(15, null);
    expect(comparison).toMatchObject({
      displayPaid: 15,
      remaining: 0,
      credit: 0,
      rounded: false,
      kind: "pending",
    });
  });

  it("shows remaining when the client pays less than the invoice", () => {
    const comparison = comparePaymentToExpected(15, 30);
    expect(comparison).toMatchObject({
      displayPaid: 15,
      remaining: 15,
      credit: 0,
      rounded: false,
      kind: "partial",
    });
    expect(resolvePaymentPostAmount(comparison)).toBe(15);
  });

  it("rounds up to the invoice when the shortfall is at most $0.15", () => {
    expect(comparePaymentToExpected(29.85, 30)).toMatchObject({
      displayPaid: 30,
      remaining: 0,
      rounded: true,
      kind: "rounded",
    });
    expect(comparePaymentToExpected(29.9, 30)?.displayPaid).toBe(30);
    expect(comparePaymentToExpected(29.97, 30)?.displayPaid).toBe(30);
    expect(resolvePaymentPostAmount(comparePaymentToExpected(29.9, 30))).toBe(
      30,
    );
  });

  it("does not round when the shortfall is over $0.15", () => {
    const comparison = comparePaymentToExpected(29.84, 30);
    expect(comparison).toMatchObject({
      displayPaid: 29.84,
      remaining: 0.16,
      rounded: false,
      kind: "partial",
    });
  });

  it("shows credit when the client pays more than $0.15 over the invoice", () => {
    const comparison = comparePaymentToExpected(35, 30);
    expect(comparison).toMatchObject({
      displayPaid: 35,
      remaining: 0,
      credit: 5,
      rounded: false,
      kind: "credit",
    });
    expect(resolvePaymentPostAmount(comparison)).toBe(35);
  });

  it("treats a tiny overpay as exact so bank cents are not credit", () => {
    const comparison = comparePaymentToExpected(30.1, 30);
    expect(comparison).toMatchObject({
      displayPaid: 30.1,
      credit: 0,
      remaining: 0,
      kind: "exact",
    });
  });

  it("treats an exact match as exact", () => {
    expect(comparePaymentToExpected(30, 30)).toMatchObject({
      displayPaid: 30,
      remaining: 0,
      credit: 0,
      kind: "exact",
    });
  });
});

describe("resolveComparisonExpected", () => {
  it("prefers the pending invoice over the plan price", () => {
    expect(resolveComparisonExpected(15, 30)).toBe(15);
  });

  it("falls back to the plan price when there is no invoice", () => {
    expect(resolveComparisonExpected(null, 30)).toBe(30);
  });

  it("returns null when neither amount is usable", () => {
    expect(resolveComparisonExpected(null, null)).toBeNull();
    expect(resolveComparisonExpected(0, -1)).toBeNull();
  });
});
