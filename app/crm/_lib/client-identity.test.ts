import { describe, expect, it } from "vitest";
import {
  buildPhoneOrFilter,
  identityMatchScore,
  phoneLookupVariants,
  rankClientIdentityMatches,
  shouldReleaseWhatsappIdentity,
} from "./client-identity";

describe("phoneLookupVariants", () => {
  it("covers WhatsApp E.164, local 0-prefix and last 10 digits", () => {
    expect(phoneLookupVariants("584242637847")).toEqual(
      expect.arrayContaining(["584242637847", "4242637847", "04242637847"]),
    );
    expect(phoneLookupVariants("+58 424-263.7847")).toEqual(
      expect.arrayContaining(["584242637847", "4242637847", "04242637847"]),
    );
  });
});

describe("buildPhoneOrFilter", () => {
  it("builds eq + like clauses for digits-only values", () => {
    const filter = buildPhoneOrFilter(["whatsapp_id", "phone"], "584242637847");
    expect(filter).toContain("whatsapp_id.eq.584242637847");
    expect(filter).toContain("phone.eq.04242637847");
    expect(filter).toContain("whatsapp_id.like.*4242637847*");
    expect(filter).toContain("phone.like.*4242637847*");
  });

  it("returns null when there are not enough digits", () => {
    expect(buildPhoneOrFilter(["phone"], "abc")).toBeNull();
  });
});

describe("rankClientIdentityMatches", () => {
  it("prefers the Wispro ficha over a stub that holds the exact WhatsApp id", () => {
    const stub = {
      id: 20,
      name: "Número desconocido",
      whatsapp_id: "584242637847",
      phone: "584242637847",
      wispro_id: null,
      created_at: "2026-09-29T10:00:00.000Z",
    };
    const linked = {
      id: 3,
      name: "Nahomy Rodriguez",
      whatsapp_id: null,
      phone: null,
      wispro_id: "wispro-nahomy",
      created_at: "2026-01-01T00:00:00.000Z",
    };

    const ranked = rankClientIdentityMatches([stub, linked], "584242637847");
    expect(ranked[0]?.id).toBe(3);
    expect(identityMatchScore(linked, "584242637847")).toBeGreaterThan(
      identityMatchScore(stub, "584242637847"),
    );
  });

  it("matches local 0-prefix phone to the international WhatsApp sender", () => {
    const client = {
      id: 8,
      phone: "04242637847",
      whatsapp_id: null,
      wispro_id: "wispro-1",
    };
    const ranked = rankClientIdentityMatches([client], "584242637847");
    expect(ranked[0]?.id).toBe(8);
  });

  it("dedupes by id and keeps the higher-scoring copy", () => {
    const ranked = rankClientIdentityMatches(
      [
        { id: 1, whatsapp_id: "584242637847", wispro_id: null },
        { id: 1, whatsapp_id: "584242637847", wispro_id: "wispro-1" },
      ],
      "584242637847",
    );
    expect(ranked).toHaveLength(1);
    expect(ranked[0]?.wispro_id).toBe("wispro-1");
  });
});

describe("shouldReleaseWhatsappIdentity", () => {
  it("releases the stub that holds this WhatsApp number", () => {
    expect(
      shouldReleaseWhatsappIdentity(
        { id: 20, whatsapp_id: "584242637847", phone: "584242637847" },
        3,
        "584242637847",
      ),
    ).toBe(true);
  });

  it("does not release the owner row", () => {
    expect(
      shouldReleaseWhatsappIdentity(
        { id: 3, whatsapp_id: "584242637847" },
        3,
        "584242637847",
      ),
    ).toBe(false);
  });

  it("does not release a different WhatsApp identity", () => {
    expect(
      shouldReleaseWhatsappIdentity(
        { id: 9, whatsapp_id: "584121111111" },
        3,
        "584242637847",
      ),
    ).toBe(false);
  });
});
