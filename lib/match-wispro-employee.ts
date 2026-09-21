import type { SupabaseClient } from "@supabase/supabase-js";
import { findCrmTechnician } from "./crm-technicians";
import { findActiveSupervisorByPhone } from "./crm-supervisors";
import {
  findEmployeeByDocumentDigits,
  findEmployeeIdByPhoneLast10,
} from "./crm-wispro-casos";
import { documentDigits, phoneLast10 } from "./phone-match";
import { pickWisproEmployeeFromCatalog } from "./pick-wispro-employee";
import {
  isTicketSupervisorEmployee,
  ticketSupervisorIds,
} from "./ticket-supervisor";
import { listTechnicians } from "./wispro";
import type { WisproEmployee } from "./wispro-types";

export type MatchedWisproEmployee = {
  id: string;
  name: string;
  phone: string | null;
  document: string | null;
  publicId?: number | null;
  isSupervisor?: boolean;
};

export { pickWisproEmployeeFromCatalog };

const toMatched = (
  employee: Pick<
    WisproEmployee,
    | "id"
    | "name"
    | "phone"
    | "phone_mobile"
    | "national_identification_number"
    | "public_id"
  >,
): MatchedWisproEmployee =>
  annotateEmployeeRole({
    id: employee.id,
    name: employee.name,
    phone: employee.phone_mobile || employee.phone,
    document: employee.national_identification_number,
    publicId: employee.public_id,
  });

export const annotateEmployeeRole = (
  employee: MatchedWisproEmployee,
): MatchedWisproEmployee => ({
  ...employee,
  isSupervisor: isTicketSupervisorEmployee({
    id: employee.id,
    publicId: employee.publicId ?? null,
  }),
});

export const enrichEmployeeSupervisorRole = async (
  employee: MatchedWisproEmployee,
): Promise<MatchedWisproEmployee> => {
  const annotated = annotateEmployeeRole(employee);
  if (annotated.isSupervisor || annotated.publicId != null) return annotated;
  if (!ticketSupervisorIds().size) {
    return annotated;
  }
  try {
    const all = await listTechnicians({ includeAll: true });
    const live = all.find((item) => item.id === employee.id);
    if (live) return toMatched(live);
  } catch (error) {
    console.warn("[WISPRO] supervisor_role_enrich_failed", error);
  }
  return annotated;
};

export const matchWisproEmployee = async (
  supabase: SupabaseClient,
  input: { phone?: string | null; document?: string | null },
): Promise<MatchedWisproEmployee | null> => {
  const document = documentDigits(input.document);
  const local = await findCrmTechnician(supabase, {
    phone: input.phone,
    document,
  });
  if (local?.active) {
    return enrichEmployeeSupervisorRole({
      id: local.employeeId,
      name: local.name,
      phone: local.whatsappPhone || local.phone,
      document: local.documentLast4,
    });
  }

  try {
    const employees = await listTechnicians();
    const live = pickWisproEmployeeFromCatalog(employees, {
      phone: input.phone,
      document,
    });
    if (live) return toMatched(live);
  } catch (error) {
    console.warn("[WISPRO] employee_match_catalog_failed", error);
  }

  try {
    const all = await listTechnicians({ includeAll: true });
    const live = pickWisproEmployeeFromCatalog(all, {
      phone: input.phone,
      document,
    });
    if (live && isTicketSupervisorEmployee({ ...live, phone: input.phone })) {
      return toMatched(live);
    }
  } catch (error) {
    console.warn("[WISPRO] supervisor_match_catalog_failed", error);
  }

  if (document) {
    const byDocument = await findEmployeeByDocumentDigits(supabase, document);
    if (byDocument) {
      return annotateEmployeeRole({
        id: byDocument.id,
        name: byDocument.name,
        phone: byDocument.phone,
        document: byDocument.document,
      });
    }
  }

  const last10 = phoneLast10(input.phone);
  const fallback = await findEmployeeIdByPhoneLast10(supabase, last10);
  if (fallback) {
    return annotateEmployeeRole({
      id: fallback.id,
      name: fallback.name,
      phone: input.phone || null,
      document: fallback.document,
    });
  }

  return supervisorIdentityFromPhone(supabase, input.phone);
};

/**
 * PRECEDENCIA DE ROLES EN WHATSAPP:
 * 1. GERENTE/SUPERVISOR (crm_supervisors activo):
 *    Si el número coincide con un supervisor activo por phone_last10, SIEMPRE
 *    se otorga el rol supervisor_wispro (isSupervisor: true). Incluso si este
 *    número también pertenece a un agente o a un técnico en el CRM/Wispro,
 *    la capacidad de supervisar y consultar colas toma precedencia.
 * 2. TÉCNICO (crm_technicians / catálogo Wispro):
 *    Si no es supervisor pero es técnico de campo activo, tiene acceso a su cola y finalización.
 * 3. CLIENTE:
 *    Flujo estándar de atención de abonados.
 */
export const supervisorIdentityFromPhone = async (
  supabase: SupabaseClient,
  phone: string | null | undefined,
): Promise<MatchedWisproEmployee | null> => {
  const supervisor = await findActiveSupervisorByPhone(supabase, phone);
  if (!supervisor) return null;
  const last10 = supervisor.phoneLast10 || phoneLast10(phone);
  return {
    id: supervisor.wisproEmployeeId || `supervisor-phone:${last10}`,
    name: supervisor.name || "Gerente",
    phone: phone || null,
    document: null,
    isSupervisor: true,
  };
};

export const applySupervisorPhoneOverride = async (
  supabase: SupabaseClient,
  employee: MatchedWisproEmployee | null,
  phone: string | null | undefined,
): Promise<MatchedWisproEmployee | null> => {
  const supervisor = await findActiveSupervisorByPhone(supabase, phone);
  if (!supervisor) return employee;
  if (employee) {
    return {
      ...employee,
      name: supervisor.name || employee.name,
      phone: employee.phone || phone || null,
      isSupervisor: true,
    };
  }
  return supervisorIdentityFromPhone(supabase, phone);
};

export const matchWisproEmployeeForPhone = (
  supabase: SupabaseClient,
  phone: string | null | undefined,
) => matchWisproEmployee(supabase, { phone });
