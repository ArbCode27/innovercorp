import { describe, expect, it } from "vitest";
import {
  buildPaymentBankStats,
  formatPlanAmountLabel,
  getPaymentApprovedAt,
  isPaymentReadyForManualApproval,
  normalizeReceptorBank,
} from "./payments";

describe("formatPlanAmountLabel", () => {
  it("formats whole plan prices as Plan 30$", () => {
    expect(formatPlanAmountLabel(30)).toBe("Plan 30$");
  });

  it("keeps cents when the plan is not a whole dollar", () => {
    expect(formatPlanAmountLabel(29.99)).toBe("Plan 29.99$");
  });

  it("returns an em dash when the plan price is missing", () => {
    expect(formatPlanAmountLabel(null)).toBe("—");
    expect(formatPlanAmountLabel(0)).toBe("—");
  });
});

describe("normalizeReceptorBank", () => {
  it("normalizes direct known banks and methods", () => {
    expect(normalizeReceptorBank("Bancamiga")).toBe("Bancamiga");
    expect(normalizeReceptorBank("Banco Bancamiga")).toBe("Bancamiga");
    expect(normalizeReceptorBank("bancamiga")).toBe("Bancamiga");

    expect(normalizeReceptorBank("Banplus")).toBe("Banplus");
    expect(normalizeReceptorBank("Banco Banplus")).toBe("Banplus");

    expect(normalizeReceptorBank("Binance")).toBe("Binance");
    expect(normalizeReceptorBank("Binance Pay (USDT)")).toBe("Binance");
    expect(normalizeReceptorBank("pago por usdt")).toBe("Binance");

    expect(normalizeReceptorBank("Tarjeta de Débito")).toBe("Tarjeta de Débito");
    expect(normalizeReceptorBank("tarjeta de debito")).toBe("Tarjeta de Débito");
    expect(normalizeReceptorBank("POS Punto de Venta")).toBe("Tarjeta de Débito");

    expect(normalizeReceptorBank("Zelle")).toBe("Zelle");
    expect(normalizeReceptorBank("transferencia zelle")).toBe("Zelle");

    expect(normalizeReceptorBank("PayPal")).toBe("PayPal");
    expect(normalizeReceptorBank("paypal account")).toBe("PayPal");
  });

  it("extracts the receptor bank from transfer descriptions with both sender and receiver", () => {
    expect(normalizeReceptorBank("Banesco a Bancamiga")).toBe("Bancamiga");
    expect(normalizeReceptorBank("Provincial -> Banplus")).toBe("Banplus");
    expect(normalizeReceptorBank("Desde Mercantil hacia Binance")).toBe("Binance");
    expect(
      normalizeReceptorBank(
        "Banco origen: Banesco, Banco destino: Bancamiga",
      ),
    ).toBe("Bancamiga");
    expect(normalizeReceptorBank("Destino: Bancamiga")).toBe("Bancamiga");
    expect(normalizeReceptorBank("Hacia Zelle")).toBe("Zelle");
  });

  it("handles null, empty, or unknown custom banks gracefully", () => {
    expect(normalizeReceptorBank(null)).toBeNull();
    expect(normalizeReceptorBank("")).toBeNull();
    expect(normalizeReceptorBank("   ")).toBeNull();
    expect(normalizeReceptorBank("BNC")).toBe("BNC");
  });
});

describe("buildPaymentBankStats", () => {
  it("seeds known collection channels with zeroes if there are no rows", () => {
    const stats = buildPaymentBankStats([]);
    expect(stats.map((s) => s.bank)).toEqual([
      "Bancamiga",
      "Banplus",
      "Binance",
      "Tarjeta de Débito",
      "Zelle",
      "PayPal",
    ]);
    expect(stats[0]).toEqual({
      bank: "Bancamiga",
      totalPayments: 0,
      totalAmount: 0,
      approvedCount: 0,
      approvedAmount: 0,
      inProcessCount: 0,
      inProcessAmount: 0,
    });
  });

  it("correctly aggregates amounts and counts per receptor channel and excludes Venezuela", () => {
    const rows = [
      { bank: "Banesco a Bancamiga", amount: 30, status: "APROBADO" as const },
      { bank: "Bancamiga", amount: 15, status: "EN_PROCESO" as const },
      { bank: "Banco de Venezuela", amount: 45, status: "APROBADO" as const },
      { bank: "BDV", amount: 20, status: "RECIBIDO" as const },
      { bank: "Banplus", amount: 10, status: "RECHAZADO" as const },
      { bank: "Binance", amount: 50, status: "APROBADO" as const },
      { bank: "Zelle", amount: 25, status: "APROBADO" as const },
      { bank: "PayPal", amount: 40, status: "EN_PROCESO" as const },
      { bank: "Tarjeta de Débito", amount: 35, status: "APROBADO" as const },
      { bank: "BNC", amount: 50, status: "APROBADO" as const },
    ];

    const stats = buildPaymentBankStats(rows);

    // Venezuela is excluded from analytics cards
    const venezuela = stats.find((s) => s.bank.toLowerCase().includes("venezuela") || s.bank === "BDV");
    expect(venezuela).toBeUndefined();

    const bancamiga = stats.find((s) => s.bank === "Bancamiga");
    expect(bancamiga).toEqual({
      bank: "Bancamiga",
      totalPayments: 2,
      totalAmount: 45,
      approvedCount: 1,
      approvedAmount: 30,
      inProcessCount: 1,
      inProcessAmount: 15,
    });

    const banplus = stats.find((s) => s.bank === "Banplus");
    expect(banplus).toEqual({
      bank: "Banplus",
      totalPayments: 1,
      totalAmount: 10,
      approvedCount: 0,
      approvedAmount: 0,
      inProcessCount: 0,
      inProcessAmount: 0,
    });

    const binance = stats.find((s) => s.bank === "Binance");
    expect(binance).toEqual({
      bank: "Binance",
      totalPayments: 1,
      totalAmount: 50,
      approvedCount: 1,
      approvedAmount: 50,
      inProcessCount: 0,
      inProcessAmount: 0,
    });

    const zelle = stats.find((s) => s.bank === "Zelle");
    expect(zelle).toEqual({
      bank: "Zelle",
      totalPayments: 1,
      totalAmount: 25,
      approvedCount: 1,
      approvedAmount: 25,
      inProcessCount: 0,
      inProcessAmount: 0,
    });

    const paypal = stats.find((s) => s.bank === "PayPal");
    expect(paypal).toEqual({
      bank: "PayPal",
      totalPayments: 1,
      totalAmount: 40,
      approvedCount: 0,
      approvedAmount: 0,
      inProcessCount: 1,
      inProcessAmount: 40,
    });

    const tarjeta = stats.find((s) => s.bank === "Tarjeta de Débito");
    expect(tarjeta).toEqual({
      bank: "Tarjeta de Débito",
      totalPayments: 1,
      totalAmount: 35,
      approvedCount: 1,
      approvedAmount: 35,
      inProcessCount: 0,
      inProcessAmount: 0,
    });

    const bnc = stats.find((s) => s.bank === "BNC");
    expect(bnc).toEqual({
      bank: "BNC",
      totalPayments: 1,
      totalAmount: 50,
      approvedCount: 1,
      approvedAmount: 50,
      inProcessCount: 0,
      inProcessAmount: 0,
    });
  });
});

describe("isPaymentReadyForManualApproval", () => {
  it("allows manual approval when status is EN_PROCESO and amount is greater than 0", () => {
    expect(
      isPaymentReadyForManualApproval({
        status: "EN_PROCESO",
        amount: 25.5,
      }),
    ).toBe(true);
  });

  it("allows manual approval when status is ERROR and amount is greater than 0", () => {
    expect(
      isPaymentReadyForManualApproval({
        status: "ERROR",
        amount: 40,
      }),
    ).toBe(true);
  });

  it("disallows manual approval when status is RECIBIDO, APROBADO or RECHAZADO", () => {
    expect(
      isPaymentReadyForManualApproval({
        status: "RECIBIDO",
        amount: 30,
      }),
    ).toBe(false);

    expect(
      isPaymentReadyForManualApproval({
        status: "APROBADO",
        amount: 30,
      }),
    ).toBe(false);

    expect(
      isPaymentReadyForManualApproval({
        status: "RECHAZADO",
        amount: 30,
      }),
    ).toBe(false);
  });

  it("disallows manual approval when amount is 0, negative, or invalid", () => {
    expect(
      isPaymentReadyForManualApproval({
        status: "EN_PROCESO",
        amount: 0,
      }),
    ).toBe(false);

    expect(
      isPaymentReadyForManualApproval({
        status: "EN_PROCESO",
        amount: -10,
      }),
    ).toBe(false);

    expect(
      isPaymentReadyForManualApproval({
        status: "EN_PROCESO",
        amount: null,
      }),
    ).toBe(false);
  });
});

describe("getPaymentApprovedAt", () => {
  it("returns null when status is not APROBADO", () => {
    expect(
      getPaymentApprovedAt({
        status: "EN_PROCESO",
        approved_at: "2026-11-05T10:00:00Z",
      }),
    ).toBeNull();

    expect(
      getPaymentApprovedAt({
        status: "RECHAZADO",
        updated_at: "2026-11-05T10:00:00Z",
      }),
    ).toBeNull();

    expect(getPaymentApprovedAt(null)).toBeNull();
  });

  it("prioritizes explicit approved_at when available", () => {
    expect(
      getPaymentApprovedAt({
        status: "APROBADO",
        approved_at: "2026-11-05T14:30:00Z",
        receipt_metadata: { approved_at: "2026-11-05T12:00:00Z" },
        updated_at: "2026-11-05T10:00:00Z",
      }),
    ).toBe("2026-11-05T14:30:00Z");
  });

  it("reads approved_at from receipt_metadata", () => {
    expect(
      getPaymentApprovedAt({
        status: "APROBADO",
        receipt_metadata: { approved_at: "2026-11-05T12:00:00Z" },
      }),
    ).toBe("2026-11-05T12:00:00Z");
  });

  it("reads manual_approved_at from receipt_metadata", () => {
    expect(
      getPaymentApprovedAt({
        status: "APROBADO",
        receipt_metadata: { manual_approved_at: "2026-11-05T13:15:00Z" },
      }),
    ).toBe("2026-11-05T13:15:00Z");
  });

  it("reads registered_at from wispro_payment metadata", () => {
    expect(
      getPaymentApprovedAt({
        status: "APROBADO",
        receipt_metadata: {
          wispro_payment: { registered_at: "2026-11-05T11:45:00Z" },
        },
      }),
    ).toBe("2026-11-05T11:45:00Z");
  });

  it("falls back to updated_at for historic approved payments", () => {
    expect(
      getPaymentApprovedAt({
        status: "APROBADO",
        receipt_metadata: {},
        updated_at: "2026-11-05T09:20:00Z",
      }),
    ).toBe("2026-11-05T09:20:00Z");
  });
});
