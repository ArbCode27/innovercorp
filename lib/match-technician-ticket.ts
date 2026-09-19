import type { CrmWisproCaso } from "./wispro-types";

const NAME_STOPWORDS = new Set([
  "el",
  "la",
  "los",
  "las",
  "de",
  "del",
  "al",
  "a",
  "un",
  "una",
  "ya",
  "mi",
  "su",
  "tu",
  "esa",
  "ese",
  "eso",
  "esta",
  "este",
  "esto",
  "aqui",
  "allí",
  "alli",
]);

const normalizeName = (value: string | null | undefined) =>
  String(value || "")
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .trim()
    .toLowerCase();

const nameTokens = (value: string) =>
  value
    .split(/\s+/)
    .map((token) => token.replace(/[^\p{L}]/gu, ""))
    .filter((token) => token.length >= 3 && !NAME_STOPWORDS.has(token));

export const matchPendingCasosForTechnician = (
  casos: CrmWisproCaso[],
  input: { publicId?: number | null; clientName?: string | null },
) => {
  if (input.publicId != null) {
    return casos.filter((caso) => caso.wisproPublicId === input.publicId);
  }
  const name = normalizeName(input.clientName);
  if (name.length < 3) return casos;
  const tokens = nameTokens(name);
  if (!tokens.length) return casos;

  const named = casos.filter((caso) => {
    const client = normalizeName(caso.clientName);
    return tokens.some((token) => client.includes(token));
  });
  if (named.length) return named;
  if (casos.length === 1) return casos;
  return [];
};
