import { describe, expect, it } from "vitest";
import {
  HISTORY_PAGE_SIZE,
  escapeIlike,
  historyListRangeIso,
  parseHistoryListQuery,
} from "./history-query";

describe("parseHistoryListQuery", () => {
  it("caps the page size at 20 and floors offset", () => {
    const query = parseHistoryListQuery(
      new URLSearchParams("limit=500&offset=-4"),
    );
    expect(query.limit).toBe(HISTORY_PAGE_SIZE);
    expect(query.offset).toBe(0);
  });

  it("swaps inverted date range and sanitizes search", () => {
    const query = parseHistoryListQuery(
      new URLSearchParams("from=2026-09-18&to=2026-09-01&q=%yeitzel_"),
    );
    expect(query.from).toBe("2026-09-01");
    expect(query.to).toBe("2026-09-18");
    expect(query.q).toBe("%yeitzel_");
  });
});

describe("historyListRangeIso", () => {
  it("uses Caracas start/end of day", () => {
    expect(historyListRangeIso({ from: "2026-09-01", to: "2026-09-01" })).toEqual({
      gte: "2026-09-01T00:00:00.000-04:00",
      lte: "2026-09-01T23:59:59.999-04:00",
    });
  });
});

describe("escapeIlike", () => {
  it("escapes wildcard characters", () => {
    expect(escapeIlike("%foo_bar\\")).toBe("\\%foo\\_bar\\\\");
  });
});
