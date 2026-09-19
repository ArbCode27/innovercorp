export type TechnicianFilterConfig = {
  includeIds?: readonly string[];
  excludeIds?: readonly string[];
};

export type TechnicianFilterableEmployee = {
  id: string;
  name: string;
  blocked?: boolean;
  blockedAt?: string | null;
  enabled?: boolean | null;
  gender?: string | null;
  status?: string | null;
};

const FEMALE_GIVEN_NAMES = new Set([
  "adriana",
  "aida",
  "alba",
  "alicia",
  "alma",
  "amelia",
  "ana",
  "andrea",
  "angela",
  "antonia",
  "aurora",
  "beatriz",
  "belen",
  "blanca",
  "brenda",
  "brigida",
  "camila",
  "carla",
  "carmen",
  "carolina",
  "catalina",
  "cecilia",
  "celeste",
  "claudia",
  "concepcion",
  "cristina",
  "daniela",
  "diana",
  "dolores",
  "doris",
  "edith",
  "elena",
  "elisa",
  "elizabeth",
  "emilia",
  "esther",
  "eugenia",
  "eva",
  "fatima",
  "fernanda",
  "flor",
  "francesca",
  "francisca",
  "gabriela",
  "gina",
  "gloria",
  "graciela",
  "guadalupe",
  "haydee",
  "hilda",
  "ines",
  "irene",
  "irma",
  "isabel",
  "ivonne",
  "janet",
  "jennifer",
  "jessica",
  "johana",
  "johanna",
  "josefa",
  "juana",
  "julia",
  "juliana",
  "karen",
  "karina",
  "karla",
  "katherine",
  "katia",
  "keila",
  "laura",
  "lidia",
  "liliana",
  "lina",
  "liz",
  "lizbeth",
  "lorena",
  "lourdes",
  "lucia",
  "lucila",
  "luisa",
  "luz",
  "magaly",
  "magda",
  "magdalena",
  "marcelia",
  "margarita",
  "maria",
  "maritza",
  "marlene",
  "marta",
  "martha",
  "mary",
  "mayra",
  "melissa",
  "mercedes",
  "milagros",
  "milena",
  "miriam",
  "mirna",
  "monica",
  "nadia",
  "nancy",
  "natalia",
  "nathalia",
  "nathaly",
  "nelly",
  "nidia",
  "noelia",
  "nohemi",
  "nora",
  "nuria",
  "olga",
  "paloma",
  "pamela",
  "paola",
  "patricia",
  "paula",
  "pilar",
  "ramona",
  "raquel",
  "rebeca",
  "reina",
  "rocio",
  "romina",
  "rosa",
  "rosario",
  "ruth",
  "sandra",
  "sara",
  "selena",
  "silvia",
  "sofia",
  "sonia",
  "stefania",
  "susana",
  "tania",
  "teresa",
  "thais",
  "ursula",
  "valentina",
  "vanessa",
  "veronica",
  "victoria",
  "virginia",
  "viviana",
  "wendy",
  "xenia",
  "ximena",
  "yadira",
  "yamile",
  "yanet",
  "yaneth",
  "yeimi",
  "yesenia",
  "yessica",
  "yohana",
  "yolanda",
  "yoselin",
  "yuliana",
  "yulimar",
  "yurima",
  "yusmary",
  "zoila",
  "zuleima",
  "zulema",
]);

const NAME_PARTICLES = new Set(["da", "de", "del", "dos", "la", "las", "los", "san", "santa"]);

const stripDiacritics = (value: string) =>
  value.normalize("NFD").replace(/\p{M}/gu, "");

const normalizeToken = (value: string) =>
  stripDiacritics(value)
    .toLowerCase()
    .replace(/[^a-z]/g, "");

export const givenNameToken = (fullName: string) => {
  const tokens = stripDiacritics(fullName)
    .split(/[\s,]+/)
    .map((token) => normalizeToken(token.split("-")[0] || ""))
    .filter(Boolean);
  return tokens.find((token) => !NAME_PARTICLES.has(token)) || tokens[0] || "";
};

export const isLikelyFemaleGivenName = (fullName: string) =>
  FEMALE_GIVEN_NAMES.has(givenNameToken(fullName));

const normalizeGender = (value: string | null | undefined) => {
  const token = normalizeToken(value || "");
  if (!token) return null;
  if (["f", "female", "femenino", "femenina", "mujer", "woman"].includes(token)) {
    return "female" as const;
  }
  if (["m", "male", "masculino", "hombre", "man", "h"].includes(token)) {
    return "male" as const;
  }
  return null;
};

const normalizeStatus = (value: string | null | undefined) =>
  normalizeToken(value || "");

export const isEmployeeActive = (employee: TechnicianFilterableEmployee) => {
  if (employee.blocked === true) return false;
  if (employee.blockedAt?.trim()) return false;
  if (employee.enabled === false) return false;
  const status = normalizeStatus(employee.status);
  if (["blocked", "bloqueado", "inactive", "inactivo", "disabled", "deshabilitado"].includes(status)) {
    return false;
  }
  return true;
};

export const isFieldTechnician = (
  employee: TechnicianFilterableEmployee,
  config: TechnicianFilterConfig = {},
) => {
  const exclude = new Set((config.excludeIds || []).map((id) => String(id).trim()).filter(Boolean));
  const include = new Set((config.includeIds || []).map((id) => String(id).trim()).filter(Boolean));

  if (exclude.has(employee.id)) return false;
  if (!isEmployeeActive(employee)) return false;
  if (include.has(employee.id)) return true;

  const gender = normalizeGender(employee.gender);
  if (gender === "female") return false;
  if (gender === "male") return true;
  return !isLikelyFemaleGivenName(employee.name);
};

export const selectFieldTechnicians = <T extends TechnicianFilterableEmployee>(
  employees: readonly T[],
  config: TechnicianFilterConfig = {},
): T[] =>
  employees
    .filter((employee) => isFieldTechnician(employee, config))
    .slice()
    .sort((left, right) => left.name.localeCompare(right.name, "es"));
