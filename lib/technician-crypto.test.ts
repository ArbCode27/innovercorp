import { describe, expect, it } from "vitest";
import {
  documentLast4,
  hashTechnicianDocument,
  hashTechnicianOtp,
  secretsEqual,
} from "./technician-crypto";

describe("technician crypto", () => {
  const secret = "test-hmac-secret";

  it("hashes cédulas by digits only", () => {
    const left = hashTechnicianDocument("V-17.855.434", secret);
    const right = hashTechnicianDocument("17855434", secret);
    expect(left).toBe(right);
    expect(left).toHaveLength(64);
    expect(documentLast4("V17855434")).toBe("5434");
  });

  it("does not hash short documents", () => {
    expect(hashTechnicianDocument("1234", secret)).toBeNull();
  });

  it("compares secrets in a length-safe way", () => {
    const hash = hashTechnicianOtp({
      technicianId: "tech-1",
      conversationId: 9,
      code: "123456",
      secret,
    });
    expect(
      secretsEqual(
        hash,
        hashTechnicianOtp({
          technicianId: "tech-1",
          conversationId: 9,
          code: "123456",
          secret,
        }),
      ),
    ).toBe(true);
    expect(
      secretsEqual(
        hash,
        hashTechnicianOtp({
          technicianId: "tech-1",
          conversationId: 9,
          code: "000000",
          secret,
        }),
      ),
    ).toBe(false);
  });
});
