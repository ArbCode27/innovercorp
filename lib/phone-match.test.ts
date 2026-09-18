import { describe, expect, it } from "vitest";
import { digitsOnly, phoneLast10, phonesMatch } from "./phone-match";

describe("phonesMatch", () => {
  it("matches Venezuelan WhatsApp, local 0-prefix and last 10 digits", () => {
    expect(phonesMatch("584123920137", "04123920137")).toBe(true);
    expect(phonesMatch("+58 412-3920137", "4123920137")).toBe(true);
    expect(phonesMatch("584123920137", "04125555555")).toBe(false);
  });

  it("returns last 10 digits", () => {
    expect(phoneLast10("+58 412 392 0137")).toBe("4123920137");
    expect(digitsOnly("0412-392.0137")).toBe("04123920137");
  });
});
