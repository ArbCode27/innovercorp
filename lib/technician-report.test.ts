import { describe, expect, it } from "vitest";
import {
  formatTechnicianCaption,
  formatTechnicianList,
} from "./technician-report";
import { collectCasoContextFromMessages } from "./caso-chat-context";

describe("formatTechnicianCaption", () => {
  it("includes name, phone, cause and maps link", () => {
    const caption = formatTechnicianCaption({
      wisproPublicId: 1842,
      kindLabel: "Visita técnica",
      clientName: "Yeitzel Pérez",
      clientPhone: "04123920137",
      cause: "sin internet",
      title: "Falla",
      addressText: "Calle X, Mume",
      mapsUrl: "https://maps.google.com/?q=10.12,-64.68",
      latitude: 10.12,
      longitude: -64.68,
      windowStart: null,
      windowEnd: null,
      facadeMediaUrl: "https://example.com/fachada.jpg",
    });
    expect(caption).toContain("Ticket #1842");
    expect(caption).toContain("Yeitzel Pérez");
    expect(caption).toContain("04123920137");
    expect(caption).toContain("sin internet");
    expect(caption).toContain("https://maps.google.com/?q=10.12,-64.68");
  });
});

describe("formatTechnicianList", () => {
  it("lists name, title and location without ticket ids or photos", () => {
    const text = formatTechnicianList([
      {
        wisproPublicId: 1,
        clientName: "Ana Pérez",
        clientPhone: "1",
        cause: "ONT",
        title: "Falla",
        addressText: "Calle 12, Mume",
        mapsUrl: "https://maps.google.com/?q=1,1",
        latitude: 1,
        longitude: 1,
        windowStart: null,
        windowEnd: null,
        facadeMediaUrl: "https://cdn.example/fachada.jpg",
      },
      {
        wisproPublicId: null,
        clientName: "Pedro Guzmán",
        clientPhone: "2",
        cause: null,
        title: "VERIFICACION DE INTERMITENCIA",
        addressText: null,
        mapsUrl: null,
        latitude: null,
        longitude: null,
        windowStart: null,
        windowEnd: null,
        facadeMediaUrl: null,
      },
    ]);
    expect(text).toContain("Tienes 2 tickets pendientes:");
    expect(text).toContain("1. Ana Pérez");
    expect(text).toContain("   ONT");
    expect(text).toContain("   Ubicación: Calle 12, Mume");
    expect(text).toContain("2. Pedro Guzmán");
    expect(text).toContain("   VERIFICACION DE INTERMITENCIA");
    expect(text).toContain("   Ubicación: Sin ubicación");
    expect(text).toContain("ficha completa");
    expect(text).not.toContain("#1");
    expect(text).not.toContain("s/n");
    expect(text).not.toContain("0412");
    expect(text).not.toContain("fachada.jpg");
    expect(text).not.toContain("maps.google.com");
  });

  it("continues numbering across pages", () => {
    const text = formatTechnicianList(
      [
        {
          wisproPublicId: 9,
          clientName: "Katiuska",
          clientPhone: null,
          cause: "Conector",
          title: "Conector",
          addressText: "Caja 4",
          mapsUrl: null,
          latitude: null,
          longitude: null,
          windowStart: null,
          windowEnd: null,
          facadeMediaUrl: null,
        },
      ],
      { startIndex: 8, remaining: 0 },
    );
    expect(text).toContain("Tienes 9 tickets pendientes:");
    expect(text).toContain("9. Katiuska");
  });

  it("omits the detail hint for supervisor lists", () => {
    const text = formatTechnicianList(
      [
        {
          wisproPublicId: 1,
          clientName: "Ana Pérez",
          clientPhone: "1",
          cause: "ONT",
          title: "Falla",
          addressText: "Calle 12, Mume",
          mapsUrl: null,
          latitude: null,
          longitude: null,
          windowStart: null,
          windowEnd: null,
          facadeMediaUrl: null,
        },
      ],
      { heading: "Joel tiene 1 ticket pendiente:", hint: null },
    );
    expect(text).toContain("Joel tiene 1 ticket pendiente:");
    expect(text).toContain("1. Ana Pérez");
    expect(text).not.toContain("ficha completa");
  });

  it("groups and orders tickets by scheduled date in format DD/MM/YYYY: with continuous numbering", () => {
    const text = formatTechnicianList([
      {
        wisproPublicId: 101,
        clientName: "EDMARY RODRIGUEZ",
        clientPhone: "04141234567",
        cause: "Luz roja LOS (pérdida de señal óptica)",
        title: "Sin internet",
        addressText: "Textiles La Fila S.A.",
        mapsUrl: null,
        latitude: null,
        longitude: null,
        windowStart: "2026-09-20T14:00:00.000Z",
        windowEnd: "2026-09-20T16:00:00.000Z",
        facadeMediaUrl: null,
      },
      {
        wisproPublicId: 102,
        clientName: "JUAN PEREZ",
        clientPhone: "04249876543",
        cause: "Corte de fibra",
        title: "Revisión técnica",
        addressText: "Calle Los Rosales",
        mapsUrl: null,
        latitude: null,
        longitude: null,
        windowStart: "2026-09-22T10:00:00.000Z",
        windowEnd: "2026-09-22T12:00:00.000Z",
        facadeMediaUrl: null,
      },
    ]);

    expect(text).toContain("20/09/2026:");
    expect(text).toContain("1. EDMARY RODRIGUEZ");
    expect(text).toContain("22/09/2026:");
    expect(text).toContain("2. JUAN PEREZ");
  });

  it("formats done tickets with resolution date and done scope header", () => {
    const text = formatTechnicianList(
      [
        {
          wisproPublicId: 50,
          clientName: "MARIA GOMEZ",
          clientPhone: null,
          cause: "Cambio de router",
          title: "Instalación",
          addressText: "Av Bolívar",
          mapsUrl: null,
          latitude: null,
          longitude: null,
          windowStart: null,
          windowEnd: null,
          facadeMediaUrl: null,
          status: "done",
          closedAt: "2026-09-21T18:30:00.000Z",
        },
      ],
      { scope: "done" },
    );

    expect(text).toContain("Tienes 1 ticket resuelto:");
    expect(text).toContain("1. MARIA GOMEZ");
    expect(text).toContain("Resuelto:");
  });
});

describe("collectCasoContextFromMessages", () => {
  it("prefers WhatsApp location pin and last inbound image", () => {
    const ctx = collectCasoContextFromMessages([
      {
        id: 1,
        type: "in",
        media_type: "image",
        media_url: "https://cdn.example/fachada.jpg",
        created_at: new Date().toISOString(),
      },
      {
        id: 2,
        type: "in",
        latitude: 10.2,
        longitude: -64.7,
        location_name: "Casa",
        location_address: "Calle 1",
      },
    ]);
    expect(ctx.mapsUrl).toBe("https://maps.google.com/?q=10.2,-64.7");
    expect(ctx.facade?.mediaUrl).toBe("https://cdn.example/fachada.jpg");
    expect(ctx.addressText).toContain("Casa");
  });
});
