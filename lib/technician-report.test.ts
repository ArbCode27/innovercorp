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
  it("summarizes pending tickets", () => {
    const text = formatTechnicianList([
      {
        wisproPublicId: 1,
        clientName: "Ana",
        clientPhone: "1",
        cause: "ONT",
        title: "ONT",
        addressText: null,
        mapsUrl: null,
        latitude: null,
        longitude: null,
        windowStart: null,
        windowEnd: null,
        facadeMediaUrl: null,
      },
    ]);
    expect(text).toContain("#1");
    expect(text).toContain("Ana");
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
