import { describe, expect, it } from "vitest";
import {
  calculateAgentRawQuality,
  calculateAgentScore,
  calculateBayesianScore,
  calculateGroupAverageQuality,
  calculateTechnicianRawQuality,
  calculateTechnicianScore,
  getPeriodDateRange,
} from "./crm-performance";
import { PERFORMANCE_CONFIG } from "./crm-performance-config";

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

describe("calculateBayesianScore", () => {
  it("returns 0 when volume is 0 or negative", () => {
    expect(
      calculateBayesianScore({
        volume: 0,
        minVolumeConfidence: 5,
        rawQuality: 100,
        groupAverageQuality: 70,
      }),
    ).toBe(0);
  });

  it("pulls low volume strongly towards group average C", () => {
    // v = 1, m = 5, R = 100, C = 70
    // (1 / 6) * 100 + (5 / 6) * 70 = 16.67 + 58.33 = 75.0
    const score = calculateBayesianScore({
      volume: 1,
      minVolumeConfidence: 5,
      rawQuality: 100,
      groupAverageQuality: 70,
    });
    expect(score).toBe(75);
  });

  it("converges towards raw quality R when volume is large", () => {
    // v = 50, m = 5, R = 100, C = 70
    // (50 / 55) * 100 + (5 / 55) * 70 = 90.91 + 6.36 = 97.3
    const score = calculateBayesianScore({
      volume: 50,
      minVolumeConfidence: 5,
      rawQuality: 100,
      groupAverageQuality: 70,
    });
    expect(score).toBe(97.3);
  });
});

describe("calculateTechnicianScore & Bayesian volume weighting (Criterio de Aceptación)", () => {
  it("returns 0 when totalAssigned is 0 or resolvedCount is 0", () => {
    expect(
      calculateTechnicianScore({
        totalAssigned: 0,
        resolvedCount: 0,
        resolutionRate: 0,
        punctualityRate: 0,
      }),
    ).toBe(0);
  });

  it("CRITERIO DE ACEPTACIÓN: Técnico con 1/1 (100%) ya NO supera a técnico con 7+ resueltos con métricas iguales o mejores", () => {
    const groupAverageQuality = 70; // Benchmark de calidad del equipo en el período

    // Técnico A: Solo 1 ticket asignado y 1 resuelto con 100% de calidad (1/1)
    const scoreTech1Resolved = calculateTechnicianScore({
      totalAssigned: 1,
      resolvedCount: 1,
      resolutionRate: 100,
      punctualityRate: 100,
      groupAverageQuality,
    });

    // Técnico B: 7 tickets resueltos con 100% de efectividad y puntualidad
    const scoreTech7Resolved100 = calculateTechnicianScore({
      totalAssigned: 7,
      resolvedCount: 7,
      resolutionRate: 100,
      punctualityRate: 100,
      groupAverageQuality,
    });

    // Técnico C: 8 tickets resueltos de 9 asignados (88.9% resolución, 90% puntualidad)
    const scoreTech8ResolvedRealist = calculateTechnicianScore({
      totalAssigned: 9,
      resolvedCount: 8,
      resolutionRate: 88.9,
      punctualityRate: 90,
      groupAverageQuality,
    });

    // 1. Técnico con 7 resueltos (100%) debe superar con holgura al de 1/1
    expect(scoreTech7Resolved100).toBeGreaterThan(scoreTech1Resolved);
    expect(scoreTech1Resolved).toBe(75.0); // (1/6)*100 + (5/6)*70
    expect(scoreTech7Resolved100).toBe(87.5); // (7/12)*100 + (5/12)*70
    expect(scoreTech7Resolved100 - scoreTech1Resolved).toBeCloseTo(12.5, 1);

    // 2. Técnico con 8 resueltos incluso con calidad algo menor (88.9% efectividad) supera al de 1/1
    expect(scoreTech8ResolvedRealist).toBeGreaterThan(scoreTech1Resolved);
  });

  it("evaluates podium eligibility according to minimum volume threshold", () => {
    const minPodiumTickets = PERFORMANCE_CONFIG.technicians.minTicketsForPodium; // 5
    expect(1 < minPodiumTickets).toBe(true);
    expect(7 >= minPodiumTickets).toBe(true);
  });
});

describe("calculateAgentScore & Bayesian volume weighting", () => {
  it("returns 0 when resolvedCases is 0", () => {
    expect(
      calculateAgentScore({
        resolvedCases: 0,
        fcrRate: 100,
        avgDurationMinutes: 10,
      }),
    ).toBe(0);
  });

  it("penalizes very low volume (e.g. 2 cases) compared to sustained high volume", () => {
    const groupAverageQuality = 70;

    // Asesor con 2 casos resueltos (100% FCR)
    const scoreLowVolume = calculateAgentScore({
      resolvedCases: 2,
      fcrRate: 100,
      avgDurationMinutes: 15,
      groupAverageQuality,
    });

    // Asesor con 40 casos resueltos (100% FCR)
    const scoreHighVolume = calculateAgentScore({
      resolvedCases: 40,
      fcrRate: 100,
      avgDurationMinutes: 15,
      groupAverageQuality,
    });

    expect(scoreHighVolume).toBeGreaterThan(scoreLowVolume);
    // Para m = 15, 2 casos tienen solo 2/17 (~11.8%) de confianza
    expect(scoreLowVolume).toBeLessThan(75);
    expect(scoreHighVolume).toBeGreaterThan(90);
  });
});

describe("calculateGroupAverageQuality", () => {
  it("returns fallback prior when list is empty", () => {
    expect(calculateGroupAverageQuality([], 70)).toBe(70);
  });

  it("calculates correct average for active scores", () => {
    expect(calculateGroupAverageQuality([80, 90, 70])).toBe(80);
  });
});
