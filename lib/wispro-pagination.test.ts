import { describe, expect, it } from "vitest";
import { readWisproPagination } from "./wispro-pagination";

describe("readWisproPagination", () => {
  it("reads nested Wispro meta.pagination", () => {
    const paging = readWisproPagination(
      {
        data: Array.from({ length: 20 }),
        meta: { pagination: { current: 1, next: 2, pages: 3, per_page: 20 } },
      },
      1,
      20,
      20,
    );
    expect(paging).toMatchObject({
      page: 1,
      nextPage: 2,
      totalPages: 3,
      hasMore: true,
    });
  });

  it("stops when the last page is shorter than per_page", () => {
    const paging = readWisproPagination(
      { meta: { current_page: 2, total_pages: 2, per_page: 20 } },
      2,
      20,
      1,
    );
    expect(paging.hasMore).toBe(false);
    expect(paging.nextPage).toBeNull();
  });

  it("assumes another page when the response is full and meta is missing", () => {
    const paging = readWisproPagination({}, 1, 20, 20);
    expect(paging.hasMore).toBe(true);
    expect(paging.nextPage).toBe(2);
  });
});
