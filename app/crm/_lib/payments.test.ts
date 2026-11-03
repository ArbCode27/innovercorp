import { describe, expect, it } from "vitest";
import {
  buildPaymentBankStats,
  formatPlanAmountLabel,
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
  it("normalizes direct known banks", () => {
    expect(normalizeReceptorBank("Bancamiga")).toBe("Bancamiga");
    expect(normalizeReceptorBank("Banco Bancamiga")).toBe("Bancamiga");
    expect(normalizeReceptorBank("bancamiga")).toBe("Bancamiga");

    expect(normalizeReceptorBank("Venezuela")).toBe("Venezuela");
    expect(normalizeReceptorBank("Banco de Venezuela")).toBe("Venezuela");
    expect(normalizeReceptorBank("BDV")).toBe("Venezuela");
    expect(normalizeReceptorBank("bdv en linea")).toBe("Venezuela");

    expect(normalizeReceptorBank("Banplus")).toBe("Banplus");
    expect(normalizeReceptorBank("Banco Banplus")).toBe("Banplus");
  });

  it("extracts the receptor bank from transfer descriptions with both sender and receiver", () => {
    expect(normalizeReceptorBank("Banesco a Bancamiga")).toBe("Bancamiga");
    expect(normalizeReceptorBank("Desde Mercantil hacia Banco de Venezuela")).toBe(
      "Venezuela",
    );
    expect(normalizeReceptorBank("Provincial -> Banplus")).toBe("Banplus");
    expect(
      normalizeReceptorBank(
        "Banco origen: Banesco, Banco destino: Banco de Venezuela",
      ),
    ).toBe("Venezuela");
    expect(normalizeReceptorBank("Destino: Bancamiga")).toBe("Bancamiga");
    expect(normalizeReceptorBank("Hacia BDV")).toBe("Venezuela");
  });

  it("handles null, empty, or unknown custom banks gracefully", () => {
    expect(normalizeReceptorBank(null)).toBeNull();
    expect(normalizeReceptorBank("")).toBeNull();
    expect(normalizeReceptorBank("   ")).toBeNull();
    expect(normalizeReceptorBank("BNC")).toBe("BNC");
  });
});

describe("buildPaymentBankStats", () => {
  it("seeds known collection banks with zeroes if there are no rows", () => {
    const stats = buildPaymentBankStats([]);
    expect(stats.map((s) => s.bank)).toEqual([
      "Venezuela",
      "Banplus",
      "Bancamiga",
    ]);
    expect(stats[0]).toEqual({
      bank: "Venezuela",
      totalPayments: 0,
      totalAmount: 0,
      approvedCount: 0,
      approvedAmount: 0,
      inProcessCount: 0,
      inProcessAmount: 0,
    });
  });

  it("correctly aggregates amounts and counts per receptor bank", () => {
    const rows = [
      { bank: "Banesco a Bancamiga", amount: 30, status: "APROBADO" as const },
      { bank: "Bancamiga", amount: 15, status: "EN_PROCESO" as const },
      { bank: "Banco de Venezuela", amount: 45, status: "APROBADO" as const },
      { bank: "BDV", amount: 20, status: "RECIBIDO" as const },
      { bank: "Banplus", amount: 10, status: "RECHAZADO" as const },
      { bank: "BNC", amount: 50, status: "APROBADO" as const },
    ];

    const stats = buildPaymentBankStats(rows);

    const venezuela = stats.find((s) => s.bank === "Venezuela");
    expect(venezuela).toEqual({
      bank: "Venezuela",
      totalPayments: 2,
      totalAmount: 65,
      approvedCount: 1,
      approvedAmount: 45,
      inProcessCount: 1,
      inProcessAmount: 20,
    });

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
