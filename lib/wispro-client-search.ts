import { documentsMatch } from "./phone-match";

export type SearchableWisproClient = {
  name: string;
  national_identification_number?: string | null;
};

const MIN_QUERY_LENGTH = 2;
const MIN_DOCUMENT_DIGITS = 5;
const MAX_DOCUMENT_DIGITS = 12;

/** Official Wispro GET /clients filters (doc.cloud.wispro.co/reference/clients). */
export const WISPRO_CLIENT_NAME_FILTER = "name_unaccent_cont";
export const WISPRO_CLIENT_DOCUMENT_FILTER =
  "national_identification_number_eq";

export const wisproNameSearchQuery = (token: string) => ({
  [WISPRO_CLIENT_NAME_FILTER]: token.trim(),
});

export const wisproDocumentSearchQuery = (query: string) => ({
  [WISPRO_CLIENT_DOCUMENT_FILTER]: query.replace(/\D/g, ""),
});

export const foldSearchText = (value: string) =>
  value
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLowerCase();

export const nameSearchTokens = (query: string) =>
  foldSearchText(query)
    .split(/[^a-z0-9]+/)
    .filter((token) => token.length >= MIN_QUERY_LENGTH);

export const looksLikeDocumentQuery = (value: string) => {
  const compact = value.replace(/[\s.-]/g, "");
  const digits = compact.replace(/\D/g, "");
  return (
    digits.length >= MIN_DOCUMENT_DIGITS &&
    digits.length <= MAX_DOCUMENT_DIGITS &&
    /^[vejg]?\d+$/i.test(compact)
  );
};

/** Values for name_unaccent_cont: full query, then longest token / surname. */
export const nameFilterAttempts = (query: string) => {
  const trimmed = foldSearchText(query.trim());
  const tokens = nameSearchTokens(query);
  if (!tokens.length) return trimmed.length >= MIN_QUERY_LENGTH ? [trimmed] : [];
  const longest = [...tokens].sort(
    (left, right) => right.length - left.length || left.localeCompare(right),
  )[0]!;
  const last = tokens[tokens.length - 1]!;
  return [...new Set([trimmed, longest, last])].filter(
    (token) => token.length >= MIN_QUERY_LENGTH,
  );
};

export const clientMatchesQuery = (
  client: SearchableWisproClient,
  query: string,
) => {
  const trimmed = query.trim();
  if (trimmed.length < MIN_QUERY_LENGTH) return false;

  if (looksLikeDocumentQuery(trimmed)) {
    return documentsMatch(client.national_identification_number, trimmed);
  }

  const tokens = nameSearchTokens(trimmed);
  if (!tokens.length) return false;

  const haystack = foldSearchText(client.name);
  return tokens.every((token) => haystack.includes(token));
};

export const filterClientsByQuery = <T extends SearchableWisproClient>(
  clients: readonly T[],
  query: string,
) => clients.filter((client) => clientMatchesQuery(client, query));

export const responseLooksUnfiltered = <T extends SearchableWisproClient>(
  clients: readonly T[],
  attemptedToken: string,
) =>
  clients.length > 0 &&
  !clients.some((client) => clientMatchesQuery(client, attemptedToken));
