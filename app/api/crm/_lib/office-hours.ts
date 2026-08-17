/**
 * Office hours + after-hours payments policy (America/Caracas).
 * Sundays and empty day slots = office closed → Nova may handle payments in human_mode.
 */

export type WeekdayKey = "mon" | "tue" | "wed" | "thu" | "fri" | "sat" | "sun";

export type OfficeHoursConfig = {
  enabled: boolean;
  timezone: string;
  /** Time windows per weekday as [start, end] HH:mm (local). Empty = closed all day. */
  days: Record<WeekdayKey, Array<[string, string]>>;
  holidays?: string[];
};

export type AfterHoursPaymentsConfig = {
  enabled: boolean;
  allowedTools: string[];
};

export const DEFAULT_OFFICE_TIMEZONE = "America/Caracas";

/** Mon–Fri 08:00–17:00, Sat 08:00–12:00, Sun closed. */
export const DEFAULT_OFFICE_HOURS: OfficeHoursConfig = {
  enabled: true,
  timezone: DEFAULT_OFFICE_TIMEZONE,
  days: {
    mon: [["08:00", "17:00"]],
    tue: [["08:00", "17:00"]],
    wed: [["08:00", "17:00"]],
    thu: [["08:00", "17:00"]],
    fri: [["08:00", "17:00"]],
    sat: [["08:00", "12:00"]],
    sun: [],
  },
  holidays: [],
};

export const DEFAULT_AFTER_HOURS_PAYMENT_TOOLS = [
  "lookup_wispro_by_cedula",
  "submit_payment_receipt",
  "get_bcv_rate",
  "link_wispro_client",
] as const;

export const DEFAULT_AFTER_HOURS_PAYMENTS: AfterHoursPaymentsConfig = {
  enabled: true,
  allowedTools: [...DEFAULT_AFTER_HOURS_PAYMENT_TOOLS],
};

const WEEKDAY_BY_INDEX: WeekdayKey[] = [
  "sun",
  "mon",
  "tue",
  "wed",
  "thu",
  "fri",
  "sat",
];

const parseHmToMinutes = (value: string): number | null => {
  const match = /^(\d{1,2}):(\d{2})$/.exec(value.trim());
  if (!match) return null;
  const hours = Number(match[1]);
  const minutes = Number(match[2]);
  if (
    !Number.isFinite(hours) ||
    !Number.isFinite(minutes) ||
    hours < 0 ||
    hours > 23 ||
    minutes < 0 ||
    minutes > 59
  ) {
    return null;
  }
  return hours * 60 + minutes;
};

/** Local calendar parts in the given IANA timezone. */
export const getZonedDateParts = (
  date: Date,
  timeZone: string,
): { year: number; month: number; day: number; weekday: WeekdayKey; minutes: number } => {
  const parts = new Intl.DateTimeFormat("en-US", {
    timeZone,
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
    weekday: "short",
    hour: "2-digit",
    minute: "2-digit",
    hourCycle: "h23",
  }).formatToParts(date);

  const read = (type: Intl.DateTimeFormatPartTypes) =>
    parts.find((part) => part.type === type)?.value || "";

  const weekdayShort = read("weekday").toLowerCase();
  const weekdayMap: Record<string, WeekdayKey> = {
    sun: "sun",
    mon: "mon",
    tue: "tue",
    wed: "wed",
    thu: "thu",
    fri: "fri",
    sat: "sat",
  };

  const hours = Number(read("hour"));
  const minutes = Number(read("minute"));

  return {
    year: Number(read("year")),
    month: Number(read("month")),
    day: Number(read("day")),
    weekday: weekdayMap[weekdayShort] || WEEKDAY_BY_INDEX[date.getUTCDay()] || "mon",
    minutes:
      (Number.isFinite(hours) ? hours : 0) * 60 +
      (Number.isFinite(minutes) ? minutes : 0),
  };
};

const isHoliday = (
  parts: { year: number; month: number; day: number },
  holidays: string[] | undefined,
): boolean => {
  if (!holidays?.length) return false;
  const iso = `${parts.year}-${String(parts.month).padStart(2, "0")}-${String(parts.day).padStart(2, "0")}`;
  return holidays.includes(iso);
};

const isInWindows = (
  minutesNow: number,
  windows: Array<[string, string]>,
): boolean => {
  for (const [start, end] of windows) {
    const startMin = parseHmToMinutes(start);
    const endMin = parseHmToMinutes(end);
    if (startMin === null || endMin === null) continue;
    if (startMin <= endMin) {
      if (minutesNow >= startMin && minutesNow < endMin) return true;
    } else {
      // Overnight window (e.g. 22:00–06:00)
      if (minutesNow >= startMin || minutesNow < endMin) return true;
    }
  }
  return false;
};

export const isWithinOfficeHours = (
  date: Date,
  config: OfficeHoursConfig = DEFAULT_OFFICE_HOURS,
): boolean => {
  if (!config.enabled) {
    // Hours feature disabled → treat as always "open" (no after-hours bypass).
    return true;
  }

  const timeZone = config.timezone || DEFAULT_OFFICE_TIMEZONE;
  const parts = getZonedDateParts(date, timeZone);

  if (isHoliday(parts, config.holidays)) {
    return false;
  }

  const windows = config.days[parts.weekday] || [];
  if (!windows.length) {
    return false;
  }

  return isInWindows(parts.minutes, windows);
};

export const isOfficeClosed = (
  date: Date = new Date(),
  config: OfficeHoursConfig = DEFAULT_OFFICE_HOURS,
): boolean => !isWithinOfficeHours(date, config);

const mergeDayWindows = (
  raw: unknown,
  fallback: Array<[string, string]>,
): Array<[string, string]> => {
  if (!Array.isArray(raw)) return fallback;
  const windows: Array<[string, string]> = [];
  for (const entry of raw) {
    if (
      Array.isArray(entry) &&
      entry.length >= 2 &&
      typeof entry[0] === "string" &&
      typeof entry[1] === "string"
    ) {
      windows.push([entry[0], entry[1]]);
    }
  }
  return windows;
};

export const parseOfficeHoursConfig = (
  raw: unknown,
): OfficeHoursConfig => {
  if (!raw || typeof raw !== "object" || Array.isArray(raw)) {
    return DEFAULT_OFFICE_HOURS;
  }

  const row = raw as Record<string, unknown>;
  const base = DEFAULT_OFFICE_HOURS;
  const daysRaw =
    row.days && typeof row.days === "object" && !Array.isArray(row.days)
      ? (row.days as Record<string, unknown>)
      : {};

  const days = { ...base.days } as OfficeHoursConfig["days"];
  for (const key of WEEKDAY_BY_INDEX) {
    if (key in daysRaw) {
      days[key] = mergeDayWindows(daysRaw[key], base.days[key]);
    }
  }

  const holidays = Array.isArray(row.holidays)
    ? row.holidays.filter((item): item is string => typeof item === "string")
    : base.holidays;

  return {
    enabled: row.enabled === undefined ? base.enabled : Boolean(row.enabled),
    timezone:
      typeof row.timezone === "string" && row.timezone.trim()
        ? row.timezone.trim()
        : base.timezone,
    days,
    holidays,
  };
};

export const parseAfterHoursPaymentsConfig = (
  raw: unknown,
): AfterHoursPaymentsConfig => {
  if (!raw || typeof raw !== "object" || Array.isArray(raw)) {
    return DEFAULT_AFTER_HOURS_PAYMENTS;
  }

  const row = raw as Record<string, unknown>;
  const allowedTools = Array.isArray(row.allowedTools)
    ? row.allowedTools.filter((item): item is string => typeof item === "string")
    : DEFAULT_AFTER_HOURS_PAYMENTS.allowedTools;

  return {
    enabled:
      row.enabled === undefined
        ? DEFAULT_AFTER_HOURS_PAYMENTS.enabled
        : Boolean(row.enabled),
    allowedTools: allowedTools.length
      ? allowedTools
      : [...DEFAULT_AFTER_HOURS_PAYMENT_TOOLS],
  };
};

/** Optional env override: CRM_OFFICE_HOURS_JSON */
export const resolveOfficeHoursFromEnv = (): OfficeHoursConfig => {
  const raw = process.env.CRM_OFFICE_HOURS_JSON?.trim();
  if (!raw) return DEFAULT_OFFICE_HOURS;
  try {
    return parseOfficeHoursConfig(JSON.parse(raw));
  } catch {
    console.warn("[OFFICE_HOURS] invalid CRM_OFFICE_HOURS_JSON, using defaults");
    return DEFAULT_OFFICE_HOURS;
  }
};
