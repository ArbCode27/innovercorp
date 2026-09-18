export const HISTORY_PAGE_SIZE = 20;
export const HISTORY_MESSAGE_PAGE_SIZE = 50;
export const HISTORY_SEARCH_MAX = 80;

const DATE_RE = /^\d{4}-\d{2}-\d{2}$/;

export type HistoryListQuery = {
  limit: number;
  offset: number;
  from: string | null;
  to: string | null;
  q: string | null;
};

export const isYmdDate = (value: string | null | undefined) =>
  Boolean(value && DATE_RE.test(value));

export const escapeIlike = (value: string) =>
  value.replace(/\\/g, "\\\\").replace(/%/g, "\\%").replace(/_/g, "\\_");

export const toCaracasStartIso = (ymd: string) => `${ymd}T00:00:00.000-04:00`;

export const toCaracasEndIso = (ymd: string) => `${ymd}T23:59:59.999-04:00`;

const parseOffset = (raw: string | null) => {
  const parsed = Number.parseInt(raw || "0", 10);
  if (!Number.isFinite(parsed) || parsed < 0) return 0;
  return parsed;
};

const parseLimit = (raw: string | null) => {
  const parsed = Number.parseInt(raw || String(HISTORY_PAGE_SIZE), 10);
  if (!Number.isFinite(parsed) || parsed < 1) return HISTORY_PAGE_SIZE;
  return Math.min(parsed, HISTORY_PAGE_SIZE);
};

const parseYmd = (raw: string | null) => {
  const value = String(raw || "").trim();
  return isYmdDate(value) ? value : null;
};

const parseSearch = (raw: string | null) => {
  const value = String(raw || "")
    .trim()
    .replace(/,/g, " ")
    .slice(0, HISTORY_SEARCH_MAX);
  return value || null;
};

export const parseHistoryListQuery = (
  searchParams: URLSearchParams,
): HistoryListQuery => {
  let from = parseYmd(searchParams.get("from"));
  let to = parseYmd(searchParams.get("to"));
  if (from && to && from > to) {
    const swap = from;
    from = to;
    to = swap;
  }

  return {
    limit: parseLimit(searchParams.get("limit")),
    offset: parseOffset(searchParams.get("offset")),
    from,
    to,
    q: parseSearch(searchParams.get("q")),
  };
};

export const historyListRangeIso = (query: Pick<HistoryListQuery, "from" | "to">) => ({
  gte: query.from ? toCaracasStartIso(query.from) : null,
  lte: query.to ? toCaracasEndIso(query.to) : null,
});

export const addDaysYmd = (ymd: string, days: number) => {
  const [year, month, day] = ymd.split("-").map(Number);
  const date = new Date(Date.UTC(year, (month || 1) - 1, day || 1));
  date.setUTCDate(date.getUTCDate() + days);
  const nextYear = date.getUTCFullYear();
  const nextMonth = String(date.getUTCMonth() + 1).padStart(2, "0");
  const nextDay = String(date.getUTCDate()).padStart(2, "0");
  return `${nextYear}-${nextMonth}-${nextDay}`;
};

export const caracasTodayYmd = (now = new Date()) =>
  new Intl.DateTimeFormat("en-CA", {
    timeZone: "America/Caracas",
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  }).format(now);
