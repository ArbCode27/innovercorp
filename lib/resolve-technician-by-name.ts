import type { SupabaseClient } from "@supabase/supabase-js";
import { listAssignedEmployeesWithPendingCasos } from "./crm-wispro-casos";
import {
  matchEmployeesByName,
  toNamedEmployee,
  type NamedEmployee,
} from "./ticket-supervisor";
import { listTechnicians } from "./wispro";

export type TechnicianNameMatch = {
  matches: NamedEmployee[];
};

export const resolveTechnicianByName = async (
  supabase: SupabaseClient,
  name: string,
): Promise<TechnicianNameMatch> => {
  const query = String(name || "").trim();
  if (query.length < 3) return { matches: [] };

  try {
    const catalog = await listTechnicians();
    const fromCatalog = matchEmployeesByName(catalog.map(toNamedEmployee), query);
    if (fromCatalog.length) return { matches: fromCatalog };
  } catch (error) {
    console.warn("[SUPERVISOR] technician_catalog_failed", error);
  }

  const assigned = await listAssignedEmployeesWithPendingCasos(supabase);
  return { matches: matchEmployeesByName(assigned, query) };
};
