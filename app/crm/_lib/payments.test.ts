import { describe, expect, it } from "vitest";
import { formatPlanAmountLabel } from "./payments";

describe("formatPlanAmountLabel", () => {
  it("formats whole plan prices as Plan 30$", () => {
    expect(formatPlanAmountLabel(30)).toBe("Plan 30$");
  });

  it("keeps cents when the plan is not a whole dollar", () => {
    expect(formatPlanAmountLabel(29.99)).toBe("Plan 29.99$");
  });

  it("returns an em dash when the plan price is missing", () => {
    expect(formatPlanAmountLabel(null)).toBe("—");
    expect(formatPlanAmountLabel(0)).toBe("—");
  });
});
