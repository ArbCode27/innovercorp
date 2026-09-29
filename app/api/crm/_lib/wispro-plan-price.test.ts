import { describe, expect, it } from "vitest";
import { parseWisproPlanName, parseWisproPlanPrice } from "./wispro-plan-price";

describe("parseWisproPlanPrice", () => {
  it("reads numeric price", () => {
    expect(parseWisproPlanPrice({ name: "BASICO 200", price: 30 })).toBe(30);
  });

  it("reads Wispro string prices like 500.0", () => {
    expect(parseWisproPlanPrice({ price: "500.0" })).toBe(500);
    expect(parseWisproPlanPrice({ price: "30.0" })).toBe(30);
  });

  it("reads string prices with currency noise", () => {
    expect(parseWisproPlanPrice({ cost: "30.00" })).toBe(30);
    expect(parseWisproPlanPrice({ value: "$29.99" })).toBe(29.99);
  });

  it("reads nested plan.price", () => {
    expect(parseWisproPlanPrice({ plan: { price: 15 } })).toBe(15);
  });

  it("returns null when there is no price", () => {
    expect(parseWisproPlanPrice({ name: "BASICO 200" })).toBeNull();
    expect(parseWisproPlanPrice(null)).toBeNull();
  });
});

describe("parseWisproPlanName", () => {
  it("trims the plan name", () => {
    expect(parseWisproPlanName({ name: " BASICO 200 " })).toBe("BASICO 200");
  });
});
