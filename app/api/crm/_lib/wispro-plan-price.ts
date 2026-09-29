import { roundMoney } from "@/app/crm/_lib/payment-amount-compare";

const PRICE_KEYS = [
  "price",
  "cost",
  "value",
  "amount",
  "monthly_price",
  "price_usd",
  "plan_price",
] as const;

const toPositiveMoney = (value: unknown): number | null => {
  if (typeof value === "number" && Number.isFinite(value) && value > 0) {
    return roundMoney(value);
  }
  if (typeof value === "string") {
    const normalized = value.trim().replace(",", ".");
    const parsed = Number.parseFloat(normalized.replace(/[^\d.-]/g, ""));
    if (Number.isFinite(parsed) && parsed > 0) return roundMoney(parsed);
  }
  return null;
};

/** Read monthly plan price from a Wispro `/plans/{id}` payload row. */
export const parseWisproPlanPrice = (
  row: Record<string, unknown> | null | undefined,
): number | null => {
  if (!row) return null;

  for (const key of PRICE_KEYS) {
    const direct = toPositiveMoney(row[key]);
    if (direct != null) return direct;
  }

  const nested = row.plan;
  if (nested && typeof nested === "object" && !Array.isArray(nested)) {
    return parseWisproPlanPrice(nested as Record<string, unknown>);
  }

  return null;
};

export const parseWisproPlanName = (
  row: Record<string, unknown> | null | undefined,
): string | null => {
  const name = typeof row?.name === "string" ? row.name.trim() : "";
  return name || null;
};
