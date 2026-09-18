import { describe, expect, it } from "vitest";
import {
  parseReporte,
  reporteToPlainDescription,
  suggestCategoryId,
} from "./parseReporte";

const EXAMPLE = `**REPORTE TÉCNICO:**
• **Motivo:** Sin conexión WiFi desde hace 2 días
• **Comportamiento:** Señal WiFi visible pero se desconecta en segundos (reproducible)
• **Reinicio:** No resuelve (desconexión 30 seg + reconexión)
• **Dispositivos afectados:** Teléfono + Televisor (no es un solo equipo)
• **Router:** Luz verde, ~1 año de uso
• **Entorno:** Casa pequeña y abierta, sin obstáculos, todo cerca del router
• **Dispositivos conectados:** 2 (1 teléfono + 1 TV)
• **Zona/OPT:** OLT MUME PON 5
• **Posible causa:** Falla en el enlace OLT/PON o en el router (señal inestable)
`;

describe("parseReporte", () => {
  it("parses the full technical report example", () => {
    const parsed = parseReporte(EXAMPLE);
    expect(parsed.motivo).toBe("Sin conexión WiFi desde hace 2 días");
    expect(parsed.zona_opt).toBe("OLT MUME PON 5");
    expect(parsed.posible_causa).toContain("Falla en el enlace OLT/PON");
    expect(parsed.reinicio).toContain("No resuelve");
    expect(parsed.reporte_tecnico).toBeUndefined();
  });

  it("parses a short report with three fields in any order", () => {
    const parsed = parseReporte(`
hola
- Zona/OPT: PON 2
* Motivo: Lentitud
• Posible causa: splitter
`);
    expect(parsed).toEqual({
      zona_opt: "PON 2",
      motivo: "Lentitud",
      posible_causa: "splitter",
    });
  });

  it("returns empty object for free text without labeled fields", () => {
    expect(parseReporte("El cliente dice que no tiene internet hoy")).toEqual(
      {},
    );
  });

  it("returns empty object for an empty string", () => {
    expect(parseReporte("")).toEqual({});
    expect(parseReporte("   \n  ")).toEqual({});
  });
});

describe("reporteToPlainDescription", () => {
  it("formats labeled fields as plain Etiqueta: valor lines", () => {
    const plain = reporteToPlainDescription(EXAMPLE);
    expect(plain).toContain("Motivo: Sin conexión WiFi desde hace 2 días");
    expect(plain).not.toContain("**");
  });
});

describe("suggestCategoryId", () => {
  it("matches keywords from motivo/posible causa against category names", () => {
    const id = suggestCategoryId(
      { motivo: "Sin conexión WiFi", posible_causa: "falla OLT" },
      [
        { id: "cat-billing", name: "Facturación" },
        { id: "cat-link", name: "Falla de enlace / OLT" },
      ],
    );
    expect(id).toBe("cat-link");
  });
});
