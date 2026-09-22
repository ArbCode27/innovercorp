import { describe, expect, it } from "vitest";
import {
  formatDurationHours,
  formatDurationMinutes,
  formatNumber,
} from "./crm-performance-formatters";

describe("crm-performance-formatters", () => {
  describe("formatNumber", () => {
    it("formats thousands with dots/separators", () => {
      const formatted = formatNumber(45463);
      // In es-VE or standard Spanish locale, thousands separator is .
      expect(formatted).toMatch(/45[.,\s]?463/);
    });

    it("formats 0 as '0'", () => {
      expect(formatNumber(0)).toBe("0");
    });

    it("returns '—' for null or undefined", () => {
      expect(formatNumber(null)).toBe("—");
      expect(formatNumber(undefined)).toBe("—");
    });
  });

  describe("formatDurationMinutes", () => {
    it("formats large minute counts to days and hours (ej: 45463 min -> 31d 13h)", () => {
      const res = formatDurationMinutes(45463);
      // 45463 / 1440 = 31.5715 -> 31 days, remainder 823 min -> 13 hours, 43 min
      expect(res.daysHours).toBe("31d 13h");
      expect(res.hoursMinutes).toMatch(/757h\s*43m/);
      expect(res.display).toBe("31d 13h");
    });

    it("formats under 1 day into hours and minutes", () => {
      const res = formatDurationMinutes(150); // 2h 30m
      expect(res.display).toBe("2h 30m");
    });

    it("formats under 1 hour into minutes", () => {
      const res = formatDurationMinutes(25);
      expect(res.display).toBe("25m");
    });

    it("handles 0 or null", () => {
      expect(formatDurationMinutes(0).display).toBe("—");
      expect(formatDurationMinutes(null).display).toBe("—");
    });
  });

  describe("formatDurationHours", () => {
    it("formats hours properly", () => {
      expect(formatDurationHours(5.5).display).toMatch(/5[.,]5h/);
      expect(formatDurationHours(48).daysHours).toBe("2d");
    });
  });
});
