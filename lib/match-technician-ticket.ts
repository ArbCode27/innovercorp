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

export type TechnicianTicketMatchInput = {
  publicId?: number | null;
  clientName?: string | null;
  listIndex?: number | null;
};

const filterCasosByClientName = (
  casos: CrmWisproCaso[],
  clientName: string | null | undefined,
) => {
  const name = normalizeName(clientName);
  if (name.length < 3) return [];
  const tokens = nameTokens(name);
  if (!tokens.length) return [];
  return casos.filter((caso) => {
    const client = normalizeName(caso.clientName);
    return tokens.some((token) => client.includes(token));
  });
};

export const matchPendingCasosForTechnician = (
  casos: CrmWisproCaso[],
  input: TechnicianTicketMatchInput,
) => {
  if (input.publicId != null) {
    return casos.filter((caso) => caso.wisproPublicId === input.publicId);
  }
  const name = normalizeName(input.clientName);
  if (name.length < 3) return casos;
  const named = filterCasosByClientName(casos, input.clientName);
  if (named.length) return named;
  if (casos.length === 1) return casos;
  return [];
};

/** Strict match for sending one ficha. Never dumps the whole queue. */
export const matchTechnicianTicketDetail = (
  casos: CrmWisproCaso[],
  input: TechnicianTicketMatchInput,
) => {
  if (input.publicId != null) {
    return casos.filter((caso) => caso.wisproPublicId === input.publicId);
  }
  if (input.listIndex != null) {
    const index = input.listIndex;
    if (!Number.isInteger(index) || index < 1 || index > casos.length) {
      return [];
    }
    return [casos[index - 1]];
  }
  const named = filterCasosByClientName(casos, input.clientName);
  if (named.length) return named;
  if (!normalizeName(input.clientName) && casos.length === 1) return casos;
  return [];
};
