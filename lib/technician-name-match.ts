export type NamedEmployee = {
  id: string;
  name: string;
  publicId?: number | null;
};

export const normalizePersonName = (value: string | null | undefined) =>
  String(value || "")
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .trim()
    .toLowerCase();

export const TECHNICIAN_NAME_MIN_SCORE = 0.7;
export const TECHNICIAN_NAME_RESOLVE_MARGIN = 0.1;
export const TECHNICIAN_NAME_SUGGESTION_LIMIT = 3;
export const TECHNICIAN_NAME_SCORE_EXACT = 1;
export const TECHNICIAN_NAME_SCORE_PHONETIC = 0.95;
export const TECHNICIAN_NAME_SCORE_LEVENSHTEIN_1 = 0.85;
export const TECHNICIAN_NAME_SCORE_LEVENSHTEIN_2 = 0.8;
export const TECHNICIAN_NAME_SCORE_PREFIX = 0.7;

export type TechnicianMatchedBy =
  | "exact"
  | "phonetic"
  | "levenshtein"
  | "prefix";

export type ScoredTechnicianCandidate<T extends NamedEmployee = NamedEmployee> =
  {
    employee: T;
    score: number;
    matchedBy: TechnicianMatchedBy;
  };

export type TechnicianNameResolution<T extends NamedEmployee = NamedEmployee> =
  | {
      status: "resolved";
      employee: T;
      matchedBy: TechnicianMatchedBy;
      score: number;
    }
  | {
      status: "ambiguous";
      candidates: Array<ScoredTechnicianCandidate<T>>;
    }
  | {
      status: "not_found";
      suggestions: Array<{ employee: T; score: number }>;
    };

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
  "y",
  "e",
  "o",
  "u",
  "en",
  "con",
  "por",
  "para",
  "que",
  "se",
  "me",
  "te",
  "le",
  "lo",
  "dame",
  "pasa",
  "pasame",
  "manda",
  "mandame",
  "envia",
  "enviame",
  "quiero",
  "necesito",
  "ver",
  "verlos",
  "consulta",
  "consultar",
  "favor",
  "please",
  "hoy",
  "ahora",
  "dia",
  "dias",
  "manana",
  "ayer",
  "semana",
  "mes",
  "cuantos",
  "cuantas",
  "tiene",
  "tienen",
  "tenga",
  "llamado",
  "llamada",
  "nombre",
  "tecnico",
  "tecnicos",
  "tecnica",
  "ticket",
  "tickets",
  "soporte",
  "equipo",
  "servicio",
  "caso",
  "casos",
  "cola",
  "ruta",
  "visita",
  "visitas",
  "listado",
  "lista",
  "lote",
  "pendiente",
  "pendientes",
  "asignado",
  "asignados",
  "asignada",
  "asignadas",
  "abierto",
  "abiertos",
  "resuelto",
  "resueltos",
  "cerrado",
  "cerrados",
  "finalizado",
  "finalizados",
  "terminado",
  "terminados",
  "completado",
  "completados",
  "solucionado",
  "solucionados",
  "atendido",
  "atendidos",
  "todos",
  "todas",
]);

const METHOD_RANK: Record<TechnicianMatchedBy, number> = {
  exact: 4,
  phonetic: 3,
  levenshtein: 2,
  prefix: 1,
};

export const technicianNameTokens = (value: string | null | undefined) =>
  normalizePersonName(value)
    .split(/[\s/_-]+/)
    .map((token) => token.replace(/[^\p{L}]/gu, ""))
    .filter((token) => token.length >= 3 && !NAME_STOPWORDS.has(token));

export const phoneticKey = (token: string) => {
  let value = normalizePersonName(token);
  value = value.replace(/ph/g, "f");
  value = value.replace(/ch/g, "\u0001");
  value = value.replace(/h/g, "");
  value = value.replace(/v/g, "b");
  value = value.replace(/z/g, "s");
  value = value.replace(/c([ei])/g, "s$1");
  value = value.replace(/qu/g, "k");
  value = value.replace(/c/g, "k");
  value = value.replace(/\u0001/g, "ch");
  value = value.replace(/(.)\1+/g, "$1");
  return value;
};

export const levenshteinDistance = (left: string, right: string) => {
  if (left === right) return 0;
  if (!left.length) return right.length;
  if (!right.length) return left.length;

  const previous = Array.from({ length: right.length + 1 }, (_, index) => index);
  for (let i = 1; i <= left.length; i += 1) {
    const current = [i];
    for (let j = 1; j <= right.length; j += 1) {
      const cost = left[i - 1] === right[j - 1] ? 0 : 1;
      current[j] = Math.min(
        current[j - 1] + 1,
        previous[j] + 1,
        previous[j - 1] + cost,
      );
    }
    for (let j = 0; j <= right.length; j += 1) {
      previous[j] = current[j] ?? 0;
    }
  }
  return previous[right.length] ?? right.length;
};

export const levenshteinTolerance = (length: number) => {
  if (length <= 3) return 0;
  if (length <= 6) return 1;
  return 2;
};

const isPrefix = (left: string, right: string) =>
  left.length >= 3 &&
  right.length >= 3 &&
  (left.startsWith(right) || right.startsWith(left));

export const scoreTokenPair = (
  queryToken: string,
  nameToken: string,
): { score: number; matchedBy: TechnicianMatchedBy } => {
  if (queryToken === nameToken) {
    return { score: TECHNICIAN_NAME_SCORE_EXACT, matchedBy: "exact" };
  }

  const queryKey = phoneticKey(queryToken);
  const nameKey = phoneticKey(nameToken);
  if (queryKey && nameKey && queryKey === nameKey) {
    return { score: TECHNICIAN_NAME_SCORE_PHONETIC, matchedBy: "phonetic" };
  }

  if (queryKey && nameKey) {
    const distance = levenshteinDistance(queryKey, nameKey);
    const tolerance = levenshteinTolerance(
      Math.min(queryKey.length, nameKey.length),
    );
    if (distance > 0 && distance <= tolerance) {
      if (distance === 1) {
        return {
          score: TECHNICIAN_NAME_SCORE_LEVENSHTEIN_1,
          matchedBy: "levenshtein",
        };
      }
      if (distance === 2) {
        return {
          score: TECHNICIAN_NAME_SCORE_LEVENSHTEIN_2,
          matchedBy: "levenshtein",
        };
      }
    }
  }

  if (isPrefix(queryToken, nameToken) || isPrefix(queryKey, nameKey)) {
    return { score: TECHNICIAN_NAME_SCORE_PREFIX, matchedBy: "prefix" };
  }

  return { score: 0, matchedBy: "prefix" };
};

const weakestMatchedBy = (methods: TechnicianMatchedBy[]): TechnicianMatchedBy =>
  methods.reduce(
    (weakest, method) =>
      METHOD_RANK[method] < METHOD_RANK[weakest] ? method : weakest,
    methods[0] || "prefix",
  );

const assignQueryTokens = (
  queryTokens: readonly string[],
  nameTokens: readonly string[],
  requirePositive: boolean,
): { score: number; matchedBy: TechnicianMatchedBy } | null => {
  if (!queryTokens.length || !nameTokens.length) return null;

  const search = (
    queryIndex: number,
    used: boolean[],
  ): { total: number; methods: TechnicianMatchedBy[] } | null => {
    if (queryIndex === queryTokens.length) return { total: 0, methods: [] };

    const queryToken = queryTokens[queryIndex];
    if (!queryToken) return null;

    let best: { total: number; methods: TechnicianMatchedBy[] } | null = null;
    for (let index = 0; index < nameTokens.length; index += 1) {
      if (used[index]) continue;
      const nameToken = nameTokens[index];
      if (!nameToken) continue;
      const pair = scoreTokenPair(queryToken, nameToken);
      if (requirePositive && pair.score <= 0) continue;
      used[index] = true;
      const rest = search(queryIndex + 1, used);
      used[index] = false;
      if (!rest) continue;
      const total = pair.score + rest.total;
      if (!best || total > best.total) {
        best = { total, methods: [pair.matchedBy, ...rest.methods] };
      }
    }
    return best;
  };

  const best = search(0, nameTokens.map(() => false));
  if (!best || (requirePositive && best.methods.length !== queryTokens.length)) {
    return null;
  }

  return {
    score: best.total / queryTokens.length,
    matchedBy: weakestMatchedBy(best.methods),
  };
};

const uniqueEmployees = <T extends NamedEmployee>(employees: readonly T[]) => {
  const byId = new Map<string, T>();
  for (const employee of employees) {
    const id = String(employee.id || "").trim();
    if (!id || byId.has(id)) continue;
    byId.set(id, employee);
  }
  return [...byId.values()];
};

export const mergeTechnicianDirectory = (
  sources: readonly (readonly NamedEmployee[])[],
) => {
  const byId = new Map<string, NamedEmployee>();
  for (const source of sources) {
    for (const employee of source) {
      const id = String(employee.id || "").trim();
      const name = String(employee.name || "").trim();
      if (!id || !name || byId.has(id)) continue;
      byId.set(id, {
        id,
        name,
        publicId: employee.publicId ?? null,
      });
    }
  }
  return [...byId.values()];
};

export const matchEmployeesByName = <T extends NamedEmployee>(
  employees: readonly T[],
  query: string | null | undefined,
): TechnicianNameResolution<T> => {
  const original = String(query || "").trim();
  const tokens = technicianNameTokens(original);
  const unique = uniqueEmployees(employees);

  if (!tokens.length) {
    return { status: "not_found", suggestions: [] };
  }

  const scored = unique.map((employee) => {
    const nameTokens = technicianNameTokens(employee.name);
    const strict = assignQueryTokens(tokens, nameTokens, true);
    const relaxed =
      assignQueryTokens(tokens, nameTokens, false) || {
        score: 0,
        matchedBy: "prefix" as const,
      };
    return {
      employee,
      strict,
      relaxedScore: relaxed.score,
    };
  });

  const qualified = scored.flatMap((item) => {
    const strict = item.strict;
    if (!strict || strict.score < TECHNICIAN_NAME_MIN_SCORE) return [];
    return [
      {
        employee: item.employee,
        score: strict.score,
        matchedBy: strict.matchedBy,
      },
    ];
  });
  qualified.sort((left, right) => right.score - left.score);

  const suggestions = [...scored]
    .sort((left, right) => right.relaxedScore - left.relaxedScore)
    .slice(0, TECHNICIAN_NAME_SUGGESTION_LIMIT)
    .map((item) => ({
      employee: item.employee,
      score: item.relaxedScore,
    }));

  if (!qualified.length) {
    return { status: "not_found", suggestions };
  }

  const top = qualified[0];
  if (!top) {
    return { status: "not_found", suggestions };
  }

  const second = qualified[1];
  const resolvedAlone = !second;
  const resolvedByMargin =
    Boolean(second) &&
    top.score - second.score >= TECHNICIAN_NAME_RESOLVE_MARGIN;

  if (resolvedAlone || resolvedByMargin) {
    return {
      status: "resolved",
      employee: top.employee,
      matchedBy: top.matchedBy,
      score: top.score,
    };
  }

  const clustered = qualified.filter(
    (item) => top.score - item.score < TECHNICIAN_NAME_RESOLVE_MARGIN,
  );

  return { status: "ambiguous", candidates: clustered };
};

export const formatTechnicianNameMatchMessage = (
  query: string,
  result: TechnicianNameResolution,
) => {
  const quoted = query.trim() || "ese técnico";
  if (result.status === "ambiguous") {
    const names = result.candidates
      .map((item) => item.employee.name)
      .join(", ");
    return `Hay varios: ${names}. ¿Cuál?`;
  }
  if (result.status === "not_found") {
    const names = result.suggestions
      .map((item) => item.employee.name)
      .filter(Boolean)
      .join(", ");
    return names
      ? `No encontré «${quoted}». ¿Quisiste decir: ${names}?`
      : `No encontré «${quoted}».`;
  }
  return null;
};

export const technicianResolvedListHeading = (
  officialName: string,
  matchedBy: TechnicianMatchedBy,
) => (matchedBy === "exact" ? null : `Tickets de ${officialName}`);

export const logTechnicianNameMatch = (
  query: string,
  result: TechnicianNameResolution,
) => {
  console.info("[TECHNICIAN_NAME]", {
    query,
    tokens: technicianNameTokens(query),
    status: result.status,
    employee_id: result.status === "resolved" ? result.employee.id : null,
    matchedBy: result.status === "resolved" ? result.matchedBy : null,
    score: result.status === "resolved" ? result.score : null,
  });
};
