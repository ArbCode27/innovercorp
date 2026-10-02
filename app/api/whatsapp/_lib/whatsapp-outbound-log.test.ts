import { describe, expect, it } from "vitest";
import {
  maskWhatsAppPhone,
  parseWhatsAppGraphError,
  parseWhatsAppStatusErrors,
} from "./whatsapp-outbound-log";

describe("maskWhatsAppPhone", () => {
  it("keeps the last four digits", () => {
    expect(maskWhatsAppPhone("584241744699")).toBe("********4699");
  });

  it("returns null when empty", () => {
    expect(maskWhatsAppPhone(null)).toBeNull();
    expect(maskWhatsAppPhone("")).toBeNull();
  });
});

describe("parseWhatsAppGraphError", () => {
  it("reads Graph API error code and subcode", () => {
    expect(
      parseWhatsAppGraphError({
        error: {
          message: "Invalid parameter",
          type: "OAuthException",
          code: 100,
          error_subcode: 33,
        },
      }),
    ).toMatchObject({
      message: "Invalid parameter",
      code: 100,
      subcode: 33,
      type: "OAuthException",
    });
  });

  it("returns null for an empty payload", () => {
    expect(parseWhatsAppGraphError({})).toBeNull();
    expect(parseWhatsAppGraphError(null)).toBeNull();
  });
});

describe("parseWhatsAppStatusErrors", () => {
  it("reads Meta delivery failure codes", () => {
    expect(
      parseWhatsAppStatusErrors({
        id: "wamid.abc",
        status: "failed",
        recipient_id: "584241744699",
        errors: [
          {
            code: 131047,
            title: "Re-engagement message",
            message: "More than 24 hours have passed",
            error_data: { details: "re-engagement window closed" },
          },
        ],
      }),
    ).toEqual([
      {
        message: "More than 24 hours have passed",
        title: "Re-engagement message",
        code: 131047,
        subcode: null,
        type: null,
        details: "re-engagement window closed",
      },
    ]);
  });
});
