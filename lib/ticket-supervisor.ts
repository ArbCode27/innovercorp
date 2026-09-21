import tecnicosConfig from "../config/tecnicos.json";
import { phoneLast10 } from "./phone-match";
import type { NamedEmployee } from "./technician-name-match";
import type { WisproEmployee } from "./wispro-types";

export type { NamedEmployee } from "./technician-name-match";
export {
  matchEmployeesByName,
  normalizePersonName,
  technicianNameTokens as personNameTokens,
} from "./technician-name-match";

type TecnicosSupervisorConfig = {
  supervisorIds?: readonly string[];
};

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
        [key: string]: unknown;
      }
    | null
    | undefined,
) => {
  if (!employee) return false;
  return isTicketSupervisorId(
    employee.id,
    employee.publicId ?? employee.public_id ?? null,
  );
};

export const toNamedEmployee = (employee: WisproEmployee): NamedEmployee => ({
  id: employee.id,
  name: employee.name,
  publicId: employee.public_id,
});
