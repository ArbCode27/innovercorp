export type ParsedReporte = Record<string, string>;

const stripAccents = (value: string) =>
  value.normalize("NFD").replace(/\p{M}/gu, "");

export const normalizeReporteLabel = (label: string) =>
  stripAccents(label)
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "_")
    .replace(/^_+|_+$/g, "");

export const humanizeReporteKey = (key: string) =>
  key
    .split("_")
    .filter(Boolean)
    .map((part) => part.charAt(0).toUpperCase() + part.slice(1))
    .join(" ");

const FIELD_LINE =
  /^\s*(?:[•\-\*]|\d+[.)])?\s*(?:\*\*)?\s*([^:*\n]+?)\s*(?:\*\*)?\s*:\s*(.*)$/;

const isHeaderLabel = (key: string) =>
  key === "reporte_tecnico" || key === "reporte" || key === "resumen";

export const parseReporte = (raw: string): ParsedReporte => {
  const text = String(raw || "");
  if (!text.trim()) return {};

  const parsed: ParsedReporte = {};

  for (const line of text.split(/\r?\n/)) {
    const match = line.match(FIELD_LINE);
    if (!match) continue;

    const label = match[1]?.replace(/\*+/g, "").trim() || "";
    const value = match[2]?.replace(/\*+/g, "").trim() || "";
    const key = normalizeReporteLabel(label);
    if (!key || !value || isHeaderLabel(key)) continue;
    if (!parsed[key]) parsed[key] = value;
  }

  return parsed;
};

export const reporteToPlainDescription = (raw: string): string => {
  const parsed = parseReporte(raw);
  const entries = Object.entries(parsed);
  if (!entries.length) {
    return String(raw || "")
      .replace(/\*+/g, "")
      .replace(/[•]/g, "-")
      .trim();
  }

  return entries
    .map(([key, value]) => `${humanizeReporteKey(key)}: ${value}`)
    .join("\n");
};

export const suggestCategoryId = (
  parsed: ParsedReporte,
  categories: Array<{ id: string; name: string }>,
): string | null => {
  const haystack = stripAccents(
    `${parsed.motivo || ""} ${parsed.posible_causa || ""}`.toLowerCase(),
  );
  if (!haystack.trim() || !categories.length) return null;

  let best: { id: string; score: number } | null = null;
  for (const category of categories) {
    const name = stripAccents(category.name.toLowerCase());
    if (!name) continue;
    const tokens = name.split(/[^a-z0-9]+/).filter((token) => token.length >= 3);
    const score = tokens.reduce(
      (total, token) => (haystack.includes(token) ? total + token.length : total),
      name && haystack.includes(name) ? name.length : 0,
    );
    if (score > 0 && (!best || score > best.score)) {
      best = { id: category.id, score };
    }
  }

  return best?.id ?? null;
};
