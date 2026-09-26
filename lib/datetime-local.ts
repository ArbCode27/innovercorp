const pad = (value: number) => String(value).padStart(2, "0");

export const toDatetimeLocalValue = (
  value: string | Date | null | undefined,
) => {
  if (!value) return "";
  const date = value instanceof Date ? value : new Date(value);
  if (Number.isNaN(date.getTime())) return "";
  return `${date.getFullYear()}-${pad(date.getMonth() + 1)}-${pad(date.getDate())}T${pad(date.getHours())}:${pad(date.getMinutes())}`;
};

export const datetimeLocalToIso = (localValue: string | null | undefined) => {
  const next = String(localValue || "").trim();
  if (!next) return null;
  const date = new Date(next);
  return Number.isNaN(date.getTime()) ? next : date.toISOString();
};

export const isDatetimeRangeValid = (
  start: string | null | undefined,
  end: string | null | undefined,
) => {
  const startValue = String(start || "").trim();
  const endValue = String(end || "").trim();
  if (!startValue || !endValue) return true;
  const startDate = new Date(startValue);
  const endDate = new Date(endValue);
  if (Number.isNaN(startDate.getTime()) || Number.isNaN(endDate.getTime())) {
    return true;
  }
  return endDate >= startDate;
};
