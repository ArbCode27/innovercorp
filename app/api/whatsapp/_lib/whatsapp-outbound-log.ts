export type WhatsAppGraphError = {
  message: string | null;
  title: string | null;
  code: number | null;
  subcode: number | null;
  type: string | null;
  details: string | null;
};

const toErrorCode = (value: unknown): number | null => {
  const code = Number(value);
  return Number.isFinite(code) ? code : null;
};

const toErrorText = (value: unknown): string | null => {
  if (typeof value !== "string") return null;
  const trimmed = value.trim();
  return trimmed || null;
};

export const maskWhatsAppPhone = (
  value: string | null | undefined,
): string | null => {
  const digits = String(value || "").replace(/\D/g, "");
  if (!digits) return null;
  if (digits.length <= 4) return digits;
  return `${"*".repeat(digits.length - 4)}${digits.slice(-4)}`;
};

const fromErrorRecord = (
  row: Record<string, unknown>,
): WhatsAppGraphError => {
  const errorData =
    row.error_data && typeof row.error_data === "object"
      ? (row.error_data as Record<string, unknown>)
      : null;

  return {
    message: toErrorText(row.message),
    title: toErrorText(row.title),
    code: toErrorCode(row.code),
    subcode: toErrorCode(row.error_subcode ?? row.subcode),
    type: toErrorText(row.type),
    details: toErrorText(errorData?.details) || toErrorText(row.details),
  };
};

/** Parse `{ error: { code, message, error_subcode } }` from Graph API. */
export const parseWhatsAppGraphError = (
  payload: unknown,
): WhatsAppGraphError | null => {
  if (!payload || typeof payload !== "object") return null;
  const root = payload as Record<string, unknown>;
  const nested =
    root.error && typeof root.error === "object"
      ? (root.error as Record<string, unknown>)
      : root;
  const parsed = fromErrorRecord(nested);
  if (
    parsed.message == null &&
    parsed.title == null &&
    parsed.code == null &&
    parsed.details == null
  ) {
    return null;
  }
  return parsed;
};

/** Parse `statuses[].errors[]` from a Meta delivery webhook. */
export const parseWhatsAppStatusErrors = (
  status: unknown,
): WhatsAppGraphError[] => {
  if (!status || typeof status !== "object") return [];
  const errors = (status as Record<string, unknown>).errors;
  if (!Array.isArray(errors)) return [];

  return errors
    .filter((item) => item && typeof item === "object")
    .map((item) => fromErrorRecord(item as Record<string, unknown>))
    .filter(
      (item) =>
        item.message != null ||
        item.title != null ||
        item.code != null ||
        item.details != null,
    );
};
