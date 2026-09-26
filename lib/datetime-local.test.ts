import { afterEach, describe, expect, it, vi } from "vitest";
import {
  datetimeLocalToIso,
  isDatetimeRangeValid,
  toDatetimeLocalValue,
} from "./datetime-local";

describe("datetime-local", () => {
  afterEach(() => {
    vi.useRealTimers();
  });

  it("formats a date for datetime-local inputs", () => {
    const date = new Date(2026, 8, 26, 8, 30);
    expect(toDatetimeLocalValue(date)).toBe("2026-09-26T08:30");
  });

  it("returns empty string for missing or invalid values", () => {
    expect(toDatetimeLocalValue(null)).toBe("");
    expect(toDatetimeLocalValue("not-a-date")).toBe("");
  });

  it("converts datetime-local values back to ISO", () => {
    expect(datetimeLocalToIso("")).toBeNull();
    expect(datetimeLocalToIso("2026-09-26T08:30")).toBe(
      new Date("2026-09-26T08:30").toISOString(),
    );
  });

  it("rejects an end time before the start time", () => {
    expect(isDatetimeRangeValid("2026-09-26T08:00", "2026-09-26T10:00")).toBe(
      true,
    );
    expect(isDatetimeRangeValid("2026-09-26T10:00", "2026-09-26T08:00")).toBe(
      false,
    );
    expect(isDatetimeRangeValid("2026-09-26T08:00", "")).toBe(true);
  });
});
