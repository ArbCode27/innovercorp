import { describe, expect, it } from "vitest";
import {
  buildMapsUrl,
  extractMapsUrl,
  parseCoordsFromMapsUrl,
  withMapsInDescription,
} from "./maps-link";

describe("maps-link", () => {
  it("extracts Google Maps and short links from free text", () => {
    expect(
      extractMapsUrl("fachada acá https://maps.app.goo.gl/abc123 gracias"),
    ).toBe("https://maps.app.goo.gl/abc123");
    expect(
      extractMapsUrl("ver https://www.google.com/maps/@10.12,-64.68,17z"),
    ).toContain("google.com/maps");
  });

  it("parses coordinates and builds a share URL", () => {
    expect(parseCoordsFromMapsUrl("https://maps.google.com/?q=10.12,-64.68")).toEqual(
      { latitude: 10.12, longitude: -64.68 },
    );
    expect(buildMapsUrl({ latitude: 10.12, longitude: -64.68 })).toBe(
      "https://maps.google.com/?q=10.12,-64.68",
    );
  });

  it("appends Maps once to a Wispro description", () => {
    const url = "https://maps.google.com/?q=10,-64";
    const first = withMapsInDescription("Sin internet", url);
    expect(first).toContain("Maps: https://maps.google.com/?q=10,-64");
    expect(withMapsInDescription(first, url)).toBe(first);
  });
});
