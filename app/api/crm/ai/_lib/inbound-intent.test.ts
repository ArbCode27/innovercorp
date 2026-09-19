import { describe, expect, it } from "vitest";
import type { AgentHistoryMessage } from "./context-builder";
import {
  classifyBurstIntent,
  inboundHasLocation,
} from "./inbound-intent";

const message = (
  input: Partial<AgentHistoryMessage> & { id: number },
): AgentHistoryMessage => ({
  type: "in",
  content: null,
  sender_type: "client",
  created_at: "2026-09-19T19:19:02.000Z",
  ...input,
});

describe("inboundHasLocation", () => {
  it("detects WhatsApp pins by media type or coordinates", () => {
    expect(inboundHasLocation(message({ id: 1, media_type: "location" }))).toBe(
      true,
    );
    expect(
      inboundHasLocation(message({ id: 2, latitude: 10.16, longitude: -66.88 })),
    ).toBe(true);
    expect(inboundHasLocation(message({ id: 3, media_type: "image" }))).toBe(
      false,
    );
  });
});

describe("classifyBurstIntent", () => {
  it("classifies a location pin as support location, not a receipt", () => {
    expect(
      classifyBurstIntent([
        message({
          id: 1,
          media_type: "location",
          content: "Ubicación compartida",
          latitude: 10.165318,
          longitude: -66.88799,
        }),
      ]),
    ).toBe("location");
  });

  it("keeps pin + facade in the same burst as location, not payment", () => {
    expect(
      classifyBurstIntent([
        message({ id: 1, media_type: "location", latitude: 10.1, longitude: -66.8 }),
        message({ id: 2, media_type: "image", content: "fachada" }),
      ]),
    ).toBe("location");
  });

  it("still treats a receipt image without a pin as payment", () => {
    expect(
      classifyBurstIntent([
        message({ id: 1, media_type: "image", content: "comprobante" }),
      ]),
    ).toBe("receipt_image");
  });
});
