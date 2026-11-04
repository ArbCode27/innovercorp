import { describe, expect, it } from "vitest";
import {
  detectBankFromText,
  parseReceiptAmount,
  parseReceiptDate,
  parseReceiptTransactionCode,
} from "./receipt-extractor";

describe("receipt-extractor helpers", () => {
  describe("parseReceiptAmount", () => {
    it("parses Venezuelan format with dot thousands and comma decimals", () => {
      expect(parseReceiptAmount("26.796,30")).toBe(26796.3);
      expect(parseReceiptAmount("Bs. 26.796,30")).toBe(26796.3);
      expect(parseReceiptAmount("Bs 1.250,00")).toBe(1250);
    });

    it("parses US standard format with comma thousands and dot decimals", () => {
      expect(parseReceiptAmount("26,796.30")).toBe(26796.3);
      expect(parseReceiptAmount("$25.50")).toBe(25.5);
    });

    it("parses simple numbers", () => {
      expect(parseReceiptAmount(1500)).toBe(1500);
      expect(parseReceiptAmount("1500,50")).toBe(1500.5);
      expect(parseReceiptAmount("1500.50")).toBe(1500.5);
    });

    it("returns null for invalid amounts", () => {
      expect(parseReceiptAmount("")).toBeNull();
      expect(parseReceiptAmount("abc")).toBeNull();
      expect(parseReceiptAmount(-50)).toBeNull();
    });
  });

  describe("parseReceiptTransactionCode", () => {
    it("extracts digits correctly", () => {
      expect(parseReceiptTransactionCode("63082316683")).toBe("63082316683");
      expect(parseReceiptTransactionCode("#63082316683")).toBe("63082316683");
      expect(parseReceiptTransactionCode("Ref: 6308-2316-683")).toBe("63082316683");
      expect(parseReceiptTransactionCode(63082316683)).toBe("63082316683");
    });

    it("rejects short strings", () => {
      expect(parseReceiptTransactionCode("12")).toBeNull();
      expect(parseReceiptTransactionCode("abc")).toBeNull();
    });
  });

  describe("parseReceiptDate", () => {
    it("parses DD/MM/YYYY into YYYY-MM-DD", () => {
      expect(parseReceiptDate("04/11/2026")).toBe("2026-11-04");
      expect(parseReceiptDate("4/11/2026")).toBe("2026-11-04");
      expect(parseReceiptDate("04-11-2026")).toBe("2026-11-04");
    });

    it("parses YYYY-MM-DD format", () => {
      expect(parseReceiptDate("2026-11-04")).toBe("2026-11-04");
    });

    it("returns null for invalid dates", () => {
      expect(parseReceiptDate("invalid")).toBeNull();
      expect(parseReceiptDate(null)).toBeNull();
    });
  });

  describe("detectBankFromText", () => {
    it("identifies bank mentioned in text or conversation", () => {
      expect(detectBankFromText("lo pasé a Bancamiga")).toBe("Bancamiga");
      expect(detectBankFromText("transferí a bancamiga")).toBe("Bancamiga");
      expect(detectBankFromText("pago móvil a venezuela")).toBe("Banco de Venezuela");
      expect(detectBankFromText("fue a bdv")).toBe("Banco de Venezuela");
      expect(detectBankFromText("a Banplus")).toBe("Banplus");
    });

    it("returns null if no known bank is found", () => {
      expect(detectBankFromText("hola buenos dias")).toBeNull();
    });
  });
});
