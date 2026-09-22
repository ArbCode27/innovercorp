import { describe, expect, it } from "vitest";
import {
  calculateAgentScore,
  calculateTechnicianScore,
  getPeriodDateRange,
} from "./crm-performance";

describe("getPeriodDateRange", () => {
  it("returns null bounds for 'all'", () => {
    expect(getPeriodDateRange("all")).toEqual({ from: null, to: null });
  });

  it("returns 7-day window for 'week'", () => {
    const fixedNow = new Date("2026-09-22T12:00:00.000Z");
    const range = getPeriodDateRange("week", fixedNow);
    expect(range.from).toBe("2026-09-15T12:00:00.000Z");
    expect(range.to).toBe("2026-09-22T12:00:00.000Z");
  });

  it("returns start of current month to now for 'month'", () => {
    const fixedNow = new Date("2026-09-22T12:00:00.000Z");
    const range = getPeriodDateRange("month", fixedNow);
    expect(range.to).toBe("2026-09-22T12:00:00.000Z");
    expect(range.from).toBeTruthy();
  });
});

describe("calculateAgentScore", () => {
  it("returns 0 when resolvedCases is 0", () => {
    expect(
      calculateAgentScore({
        resolvedCases: 0,
        maxCasesInPeriod: 10,
        fcrRate: 100,
        avgDurationMinutes: 10,
      }),
    ).toBe(0);
  });

  it("calculates high score for agent with high FCR and fast resolution", () => {
    const score = calculateAgentScore({
      resolvedCases: 20,
      maxCasesInPeriod: 20,
      fcrRate: 95,
      avgDurationMinutes: 12, // <= 15 min: 100 speed points
    });
    // (95 * 0.4) + (100 * 0.35) + (100 * 0.25) = 38 + 35 + 25 = 98
    expect(score).toBe(98);
  });

  it("reduces score if FCR or volume is low", () => {
    const score = calculateAgentScore({
      resolvedCases: 5,
      maxCasesInPeriod: 20, // 25% volume = 25 pts
      fcrRate: 70, // 70 * 0.4 = 28 pts
      avgDurationMinutes: 45, // 75 speed pts * 0.25 = 18.75 pts
    });
    // 28 + (25 * 0.35) + 18.75 = 28 + 8.75 + 18.75 = 55.5
    expect(score).toBe(55.5);
  });
});

describe("calculateTechnicianScore", () => {
  it("returns 0 when totalAssigned is 0 or resolvedCount is 0", () => {
    expect(
      calculateTechnicianScore({
        totalAssigned: 0,
        resolvedCount: 0,
        maxResolvedInPeriod: 10,
        resolutionRate: 0,
        punctualityRate: 0,
      }),
    ).toBe(0);
  });

  it("calculates high score for high resolution rate and punctual technician", () => {
    const score = calculateTechnicianScore({
      totalAssigned: 10,
      resolvedCount: 10,
      maxResolvedInPeriod: 10,
      resolutionRate: 100,
      punctualityRate: 100,
    });
    // (100 * 0.45) + (100 * 0.3) + (100 * 0.25) = 45 + 30 + 25 = 100
    expect(score).toBe(100);
  });

  it("weights punctuality and resolution rate appropriately", () => {
    const score = calculateTechnicianScore({
      totalAssigned: 10,
      resolvedCount: 8,
      maxResolvedInPeriod: 10,
      resolutionRate: 80, // 80 * 0.45 = 36
      punctualityRate: 90, // 90 * 0.3 = 27
    });
    // 36 + 27 + (80 * 0.25 = 20) = 83
    expect(score).toBe(83);
  });
});
