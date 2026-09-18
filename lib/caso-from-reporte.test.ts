import { describe, expect, it } from "vitest";
import { casoFieldsFromReporte } from "./caso-from-reporte";

const NOVA_REPORT = `He registrado correctamente:

**Google Maps:** 10.1492927,-66.8469102

---
**REPORTE TÉCNICO:**
• **Cliente:** Abraham Rojas (Sandra Key Serrano) | C.I: 17.855.434 | Plan: BÁSICO 200
• **Motivo:** Luz roja PON detectada — falla en línea óptica
• **Estado de luces:** Luz roja (PON) encendida de forma constante
• **Ubicación:** El Cafetal, Quinta Nova y Vero | Maps: 10.1492927,-66.8469102
• **Fachada:** Fotografía recibida y adjunta al ticket
• **Acción requerida:** Visita técnica prioritaria de campo para revisión de fibra óptica
`;

describe("casoFieldsFromReporte", () => {
  it("fills ticket fields, address and Maps from a Nova report", () => {
    const fields = casoFieldsFromReporte(NOVA_REPORT);
    expect(fields.title).toContain("Luz roja PON");
    expect(fields.parsed.motivo).toContain("Luz roja PON");
    expect(fields.parsed.accion_requerida).toContain("Visita técnica prioritaria");
    expect(fields.addressText).toBe("El Cafetal, Quinta Nova y Vero");
    expect(fields.mapsUrl).toBe(
      "https://maps.google.com/?q=10.1492927,-66.8469102",
    );
    expect(fields.latitude).toBeCloseTo(10.1492927);
    expect(fields.longitude).toBeCloseTo(-66.8469102);
    expect(fields.description).toContain("Motivo:");
    expect(fields.cause).toContain("Luz roja PON");
  });
});
