import { describe, expect, it } from "vitest";
import { formatLocationForAi } from "./location-message";

describe("formatLocationForAi", () => {
  it("includes coordinates and a Maps URL for the ticket GPS", () => {
    const text = formatLocationForAi({
      content: "Ubicación compartida",
      latitude: 10.165318,
      longitude: -66.88799,
      location_name: "Casa Tania",
    });

    expect(text).toContain("[Ubicación]");
    expect(text).toContain("Casa Tania");
    expect(text).toContain("10.165318, -66.88799");
    expect(text).toContain("https://maps.google.com/?q=10.165318,-66.88799");
  });

  it("renders a pin without a place name", () => {
    expect(
      formatLocationForAi({
        content: "Ubicación compartida",
        latitude: 10.2,
        longitude: -64.7,
      }),
    ).toBe("[Ubicación] · 10.2, -64.7 · https://maps.google.com/?q=10.2,-64.7");
  });
});
