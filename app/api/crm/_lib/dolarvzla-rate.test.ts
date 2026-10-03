import { describe, expect, it } from "vitest";
import {
  convertUsdToBs,
  formatBcvRate,
  formatBolivares,
  formatUsd,
} from "./dolarvzla-rate";

describe("formatBcvRate", () => {
  it("keeps hundreds without a thousands dot", () => {
    expect(formatBcvRate(871.3689)).toBe("871,37 Bs/$");
  });

  it("uses a thousands dot only from 1.000", () => {
    expect(formatBcvRate(87136.99)).toBe("87.136,99 Bs/$");
  });
});

describe("formatBolivares", () => {
  it("quotes 30 USD at 871.37 as Bs. 26.141,07", () => {
    expect(formatBolivares(convertUsdToBs(30, 871.3689))).toBe("Bs. 26.141,07");
  });
});

describe("formatUsd", () => {
  it("formats with VE separators", () => {
    expect(formatUsd(30)).toBe("$30,00");
  });
});
