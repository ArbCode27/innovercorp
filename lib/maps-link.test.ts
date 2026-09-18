import { describe, expect, it } from "vitest";
import {
  extractMapsFromText,
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
    expect(parseCoordsFromMapsUrl("Maps: 10.1492927,-66.8469102")).toEqual({
      latitude: 10.1492927,
      longitude: -66.8469102,
    });
    expect(extractMapsFromText("Google Maps: 10.1492927,-66.8469102")).toEqual({
      mapsUrl: "https://maps.google.com/?q=10.1492927,-66.8469102",
      latitude: 10.1492927,
      longitude: -66.8469102,
    });
  });

  it("appends Maps once to a Wispro description", () => {
    const url = "https://maps.google.com/?q=10,-64";
    const first = withMapsInDescription("Sin internet", url);
    expect(first).toContain("Maps: https://maps.google.com/?q=10,-64");
    expect(withMapsInDescription(first, url)).toBe(first);
  });
});
