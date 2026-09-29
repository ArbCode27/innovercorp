import { describe, expect, it } from "vitest";
import {
  matchInvoicesToPaymentAmount,
  pickSinglePendingInvoice,
  type WisproInvoiceBalance,
} from "./wispro-invoice-match";

const invoice = (
  overrides: Partial<WisproInvoiceBalance> & { id: string },
): WisproInvoiceBalance => ({
  balance: 30,
  amount: 30,
  issuedAt: "2026-09-01T00:00:00.000Z",
  firstDueDate: "2026-09-05",
  invoiceNumber: "F-1",
  state: "pending",
  ...overrides,
});

describe("pickSinglePendingInvoice", () => {
  it("keeps the newest invoice when Wispro returns extras", () => {
    const picked = pickSinglePendingInvoice([
      invoice({
        id: "old",
        issuedAt: "2026-08-01T00:00:00.000Z",
        firstDueDate: "2026-08-05",
      }),
      invoice({
        id: "new",
        issuedAt: "2026-09-01T00:00:00.000Z",
        firstDueDate: "2026-09-05",
      }),
    ]);
    expect(picked.invoice?.id).toBe("new");
    expect(picked.extraCount).toBe(1);
  });
});

describe("matchInvoicesToPaymentAmount", () => {
  it("rounds a $0.10 shortfall and posts the invoice amount", () => {
    const match = matchInvoicesToPaymentAmount(
      [invoice({ id: "inv-1" })],
      29.9,
    );
    expect(match.strategy).toBe("single_rounded");
    expect(match.postAmount).toBe(30);
    expect(match.rounded).toBe(true);
    expect(match.invoiceIds).toEqual(["inv-1"]);
  });

  it("keeps a partial payment and reports remaining", () => {
    const match = matchInvoicesToPaymentAmount(
      [invoice({ id: "inv-1" })],
      15,
    );
    expect(match.strategy).toBe("single_partial");
    expect(match.postAmount).toBe(15);
    expect(match.remaining).toBe(15);
  });

  it("posts the full overpay and reports credit", () => {
    const match = matchInvoicesToPaymentAmount(
      [invoice({ id: "inv-1" })],
      35,
    );
    expect(match.strategy).toBe("single_overpay");
    expect(match.postAmount).toBe(35);
    expect(match.credit).toBe(5);
    expect(match.unmatchedAmount).toBe(5);
  });
});
