import { describe, expect, it } from "vitest";
import {
  buildPaymentSuccessMessage,
  PAYMENT_SUCCESS_VARIABLES,
  resolvePaymentMonth,
} from "./payment-success-message";

describe("payment-success-message", () => {
  it("resolves the month in Spanish uppercase for Venezuela timezone", () => {
    // 2026-11-05 should be NOVIEMBRE
    const monthNov = resolvePaymentMonth("2026-11-05");
    expect(monthNov).toBe("NOVIEMBRE");

    // 2026-08-15 should be AGOSTO
    const monthAug = resolvePaymentMonth("2026-08-15");
    expect(monthAug).toBe("AGOSTO");
  });

  it("replaces {{mes}} with resolved month", () => {
    const template = "Servicio activo para el mes de {{mes}}.";
    const result = buildPaymentSuccessMessage({
      template,
      paymentDate: "2026-11-06",
    });
    expect(result).toBe("Servicio activo para el mes de NOVIEMBRE.");
  });

  it("handles case-insensitive and whitespace-tolerant variants: {{MES}}, {{ mes }}, {mes}", () => {
    const template =
      "Mes 1: {{mes}}, Mes 2: {{MES}}, Mes 3: {{ mes }}, Mes 4: {mes}";
    const result = buildPaymentSuccessMessage({
      template,
      paymentDate: "2026-12-01",
    });
    expect(result).toBe(
      "Mes 1: DICIEMBRE, Mes 2: DICIEMBRE, Mes 3: DICIEMBRE, Mes 4: DICIEMBRE",
    );
  });

  it("exports PAYMENT_SUCCESS_VARIABLES containing {{mes}}", () => {
    expect(PAYMENT_SUCCESS_VARIABLES.some((v) => v.token === "{{mes}}")).toBe(
      true,
    );
  });
});
