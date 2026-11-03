import { describe, expect, it } from "vitest";
import {
  buildExportFileName,
  generatePaymentsCsv,
  generatePaymentsExcelXml,
  groupPaymentsByBank,
} from "./payments-export";
import type { CrmPayment } from "./payments";

const createMockPayment = (overrides: Partial<CrmPayment>): CrmPayment => ({
  id: "mock-id-1",
  client_id: 1,
  conversation_id: 10,
  message_id: 100,
  submitted_by_agent_id: 5,
  wispro_client_id: "w-1",
  client_name: "Juan Perez & Hijos",
  cedula: "V12345678",
  phone_id: "584241111111",
  amount: 30,
  amount_raw: "6687.00",
  bank: "Bancamiga",
  transaction_code: "123456",
  payment_date: "2026-11-01",
  comment: "Pago mensual <Plan 30$>",
  status: "APROBADO",
  source: "ai",
  external_payment_id: null,
  external_api_status: null,
  error_message: null,
  receipt_media_url: null,
  created_at: "2026-11-01T12:00:00Z",
  updated_at: "2026-11-01T12:00:00Z",
  ...overrides,
});

describe("payments-export", () => {
  describe("buildExportFileName", () => {
    it("names the file for a single bank", () => {
      const name = buildExportFileName(
        ["Bancamiga"],
        { from: "2026-11-01", to: "2026-11-02" },
        "xls",
      );
      expect(name).toBe("pagos_bancamiga_2026-11-01_a_2026-11-02.xls");
    });

    it("names the file for multiple banks", () => {
      const name = buildExportFileName(
        ["Bancamiga", "Venezuela"],
        { from: "2026-11-01", to: "2026-11-02" },
        "xls",
      );
      expect(name).toBe("pagos_2_bancos_2026-11-01_a_2026-11-02.xls");
    });

    it("defaults to todos_los_bancos when all is selected", () => {
      const name = buildExportFileName(
        ["all"],
        { from: "2026-11-01", to: "2026-11-02" },
        "csv",
      );
      expect(name).toBe("pagos_todos_los_bancos_2026-11-01_a_2026-11-02.csv");
    });
  });

  describe("groupPaymentsByBank", () => {
    it("groups payments by normalized bank and sums amounts correctly", () => {
      const p1 = createMockPayment({
        id: "1",
        bank: "Banesco a Bancamiga",
        amount: 30,
        status: "APROBADO",
      });
      const p2 = createMockPayment({
        id: "2",
        bank: "Bancamiga",
        amount: 20,
        status: "EN_PROCESO",
      });
      const p3 = createMockPayment({
        id: "3",
        bank: "BDV",
        amount: 50,
        status: "APROBADO",
      });

      const groups = groupPaymentsByBank([p1, p2, p3]);

      expect(groups).toHaveLength(2);

      const bancamigaGroup = groups.find((g) => g.bankName === "Bancamiga");
      expect(bancamigaGroup).toBeDefined();
      expect(bancamigaGroup?.payments).toHaveLength(2);
      expect(bancamigaGroup?.totalAmount).toBe(50);
      expect(bancamigaGroup?.approvedCount).toBe(1);
      expect(bancamigaGroup?.approvedAmount).toBe(30);
      expect(bancamigaGroup?.inProcessCount).toBe(1);

      const venzGroup = groups.find((g) => g.bankName === "Venezuela");
      expect(venzGroup).toBeDefined();
      expect(venzGroup?.payments).toHaveLength(1);
      expect(venzGroup?.totalAmount).toBe(50);
      expect(venzGroup?.approvedCount).toBe(1);
    });
  });

  describe("generatePaymentsExcelXml", () => {
    it("generates valid XML with escaped characters and totals", () => {
      const p1 = createMockPayment({
        id: "1",
        bank: "Bancamiga",
        amount: 30,
        client_name: "Comercial & Servicios <A & B>",
        comment: 'Factura "especial"',
        status: "APROBADO",
      });
      const p2 = createMockPayment({
        id: "2",
        bank: "Venezuela",
        amount: 45,
        status: "EN_PROCESO",
      });

      const xml = generatePaymentsExcelXml({
        payments: [p1, p2],
        selectedBanks: ["Bancamiga", "Venezuela"],
        dateRange: { from: "2026-11-01", to: "2026-11-02" },
      });

      expect(xml).toContain('<?xml version="1.0" encoding="UTF-8"?>');
      expect(xml).toContain('<?mso-application progid="Excel.Sheet"?>');
      expect(xml).toContain("INNOVER CORP · REPORTE DE PAGOS RECIBIDOS");
      expect(xml).toContain("BANCO: BANCAMIGA");
      expect(xml).toContain("BANCO: VENEZUELA");
      expect(xml).toContain("TOTAL GENERAL DE PAGOS RECIBIDOS (2 pagos)");

      // Special characters must be properly escaped
      expect(xml).toContain("Comercial &amp; Servicios &lt;A &amp; B&gt;");
      expect(xml).toContain("Factura &quot;especial&quot;");
      expect(xml).not.toContain("<A & B>");

      // Totals
      expect(xml).toContain("<Data ss:Type=\"Number\">75</Data>");
    });

    it("handles empty payments list gracefully", () => {
      const xml = generatePaymentsExcelXml({
        payments: [],
        selectedBanks: ["Bancamiga"],
        dateRange: { from: "2026-11-01", to: "2026-11-02" },
      });

      expect(xml).toContain("No se encontraron movimientos registrados");
      expect(xml).toContain("<Data ss:Type=\"Number\">0</Data>");
    });
  });

  describe("generatePaymentsCsv", () => {
    it("generates CSV with UTF-8 BOM and correct headers", () => {
      const p1 = createMockPayment({
        id: "1",
        bank: "Bancamiga",
        amount: 30,
        client_name: "Juan Perez",
        status: "APROBADO",
      });

      const csv = generatePaymentsCsv({
        payments: [p1],
        selectedBanks: ["Bancamiga"],
        dateRange: { from: "2026-11-01", to: "2026-11-02" },
      });

      expect(csv.startsWith("\uFEFF")).toBe(true);
      expect(csv).toContain("Nro,Fecha,Banco Receptor,Cedula/RIF,Cliente,Referencia,Estado,Monto USD,Monto Bs,Comentario");
      expect(csv).toContain("Bancamiga");
      expect(csv).toContain("TOTAL GENERAL");
      expect(csv).toContain("30.00");
    });
  });
});
