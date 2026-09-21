import tecnicosConfig from "../config/tecnicos.json";
import { phoneLast10 } from "./phone-match";
import type { WisproEmployee } from "./wispro-types";

export type NamedEmployee = {
  id: string;
  name: string;
  publicId?: number | null;
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
  "tecnico",
  "tecnicos",
  "tecnica",
]);

type TecnicosSupervisorConfig = {
  supervisorIds?: readonly string[];
  supervisorPhones?: readonly string[];
};

export const normalizePersonName = (value: string | null | undefined) =>
  String(value || "")
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .trim()
    .toLowerCase();

export const personNameTokens = (value: string) =>
  value
    .split(/\s+/)
    .map((token) => token.replace(/[^\p{L}]/gu, ""))
    .filter((token) => token.length >= 3 && !NAME_STOPWORDS.has(token));

const splitIdList = (value: string | null | undefined) =>
  String(value || "")
    .split(/[,\s]+/)
    .map((item) => item.replace(/^#/, "").trim())
    .filter(Boolean);

export const ticketSupervisorIds = () => {
  const fromFile = ((tecnicosConfig as TecnicosSupervisorConfig).supervisorIds ||
    []) as readonly string[];
  return new Set(
    [...fromFile, ...splitIdList(process.env.WISPRO_SUPERVISOR_EMPLOYEE_IDS)].map(
      (id) => String(id).trim(),
    ).filter(Boolean),
  );
};

export const ticketSupervisorPhones = () => {
  const fromFile = ((tecnicosConfig as TecnicosSupervisorConfig)
    .supervisorPhones || []) as readonly string[];
  return new Set(
    [...fromFile, ...splitIdList(process.env.WISPRO_SUPERVISOR_PHONES)]
      .map((value) => phoneLast10(value))
      .filter((value): value is string => Boolean(value)),
  );
};

export const isTicketSupervisorPhone = (phone?: string | null) => {
  const last10 = phoneLast10(phone);
  return Boolean(last10 && ticketSupervisorPhones().has(last10));
};

export const isTicketSupervisorId = (
  employeeId?: string | null,
  publicId?: number | null,
) => {
  const ids = ticketSupervisorIds();
  if (!ids.size) return false;
  if (employeeId && ids.has(employeeId)) return true;
  if (publicId != null && ids.has(String(publicId))) return true;
  return false;
};

export const isTicketSupervisorEmployee = (
  employee:
    | {
        id?: string | null;
        publicId?: number | null;
        public_id?: number | null;
        phone?: string | null;
        phone_mobile?: string | null;
      }
    | null
    | undefined,
) => {
  if (!employee) return false;
  if (
    isTicketSupervisorId(
      employee.id,
      employee.publicId ?? employee.public_id ?? null,
    )
  ) {
    return true;
  }
  return (
    isTicketSupervisorPhone(employee.phone) ||
    isTicketSupervisorPhone(employee.phone_mobile)
  );
};

export const matchEmployeesByName = <T extends NamedEmployee>(
  employees: readonly T[],
  query: string | null | undefined,
): T[] => {
  const normalized = normalizePersonName(query);
  if (normalized.length < 3) return [];
  const tokens = personNameTokens(normalized);
  if (!tokens.length) return [];

  const exact = employees.filter(
    (employee) => normalizePersonName(employee.name) === normalized,
  );
  if (exact.length) return exact;

  const givenExact = employees.filter((employee) => {
    const first = personNameTokens(normalizePersonName(employee.name))[0];
    return Boolean(first) && tokens.length === 1 && first === tokens[0];
  });
  if (givenExact.length) return givenExact;

  return employees.filter((employee) => {
    const name = normalizePersonName(employee.name);
    return tokens.every((token) => name.includes(token));
  });
};

export const toNamedEmployee = (employee: WisproEmployee): NamedEmployee => ({
  id: employee.id,
  name: employee.name,
  publicId: employee.public_id,
});
