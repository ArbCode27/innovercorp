export type WisproPagination = {
  page: number;
  nextPage: number | null;
  totalPages: number | null;
  perPage: number | null;
  hasMore: boolean;
};

const readFiniteNumber = (value: unknown) => {
  if (typeof value === "number" && Number.isFinite(value)) return value;
  if (typeof value === "string" && value.trim()) {
    const parsed = Number(value);
    return Number.isFinite(parsed) ? parsed : null;
  }
  return null;
};

const asRecord = (value: unknown): Record<string, unknown> | null =>
  value && typeof value === "object" ? (value as Record<string, unknown>) : null;

export const readWisproPagination = (
  payload: unknown,
  requestedPage: number,
  pageSize: number,
  rowCount: number,
): WisproPagination => {
  const root = asRecord(payload);
  const meta = asRecord(root?.meta) || asRecord(root?.pagination);
  const nested = asRecord(meta?.pagination) || meta;

  const page =
    readFiniteNumber(nested?.current) ||
    readFiniteNumber(nested?.current_page) ||
    readFiniteNumber(nested?.page) ||
    requestedPage;
  const totalPages =
    readFiniteNumber(nested?.pages) ||
    readFiniteNumber(nested?.total_pages) ||
    readFiniteNumber(nested?.totalPages);
  const perPage =
    readFiniteNumber(nested?.per_page) ||
    readFiniteNumber(nested?.perPage) ||
    pageSize;
  const explicitNext =
    readFiniteNumber(nested?.next) || readFiniteNumber(nested?.next_page);

  const hasMoreByMeta =
    explicitNext != null
      ? explicitNext > page
      : totalPages != null
        ? page < totalPages
        : rowCount >= perPage;

  return {
    page,
    nextPage: hasMoreByMeta ? explicitNext || page + 1 : null,
    totalPages,
    perPage,
    hasMore: hasMoreByMeta && rowCount > 0,
  };
};
