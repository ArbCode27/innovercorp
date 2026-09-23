import type { SupabaseClient } from "@supabase/supabase-js";
import { listAssignedEmployees } from "./crm-wispro-casos";
import {
  matchEmployeesByName,
  mergeTechnicianDirectory,
  type TechnicianNameResolution,
} from "./technician-name-match";
import { toNamedEmployee, type NamedEmployee } from "./ticket-supervisor";
import { listTechnicians } from "./wispro";

export const TECHNICIAN_DIRECTORY_TTL_MS = 5 * 60 * 1000;

type DirectoryCache = {
  expiresAt: number;
  employees: NamedEmployee[];
};

let directoryCache: DirectoryCache | null = null;

export const resetTechnicianDirectoryCache = () => {
  directoryCache = null;
};

export { mergeTechnicianDirectory };

const loadCrmTechnicianNames = async (
  supabase: SupabaseClient,
): Promise<NamedEmployee[]> => {
  const { data, error } = await supabase
    .from("crm_technicians")
    .select("employee_id, id, name")
    .eq("active", true)
    .limit(500);

  if (error) {
    console.warn("[TECHNICIAN_DIRECTORY] crm_technicians_failed", error.message);
    return [];
  }

  return (data || [])
    .map((row) => ({
      id: String(row.employee_id || row.id || "").trim(),
      name: String(row.name || "").trim(),
    }))
    .filter((item) => item.id && item.name);
};

const loadWisproCatalog = async (): Promise<NamedEmployee[]> => {
  try {
    const catalog = await listTechnicians();
    return catalog.map(toNamedEmployee);
  } catch (error) {
    console.warn("[SUPERVISOR] technician_catalog_failed", error);
    return [];
  }
};

export const getTechnicianDirectory = async (
  supabase: SupabaseClient,
  input?: { forceRefresh?: boolean },
): Promise<NamedEmployee[]> => {
  if (
    !input?.forceRefresh &&
    directoryCache &&
    directoryCache.expiresAt > Date.now()
  ) {
    return directoryCache.employees;
  }

  const [catalog, local, fromCasos] = await Promise.all([
    loadWisproCatalog(),
    loadCrmTechnicianNames(supabase),
    listAssignedEmployees(supabase).catch((error) => {
      console.warn("[TECHNICIAN_DIRECTORY] casos_failed", error);
      return [] as NamedEmployee[];
    }),
  ]);

  const employees = mergeTechnicianDirectory([catalog, local, fromCasos]);
  directoryCache = {
    expiresAt: Date.now() + TECHNICIAN_DIRECTORY_TTL_MS,
    employees,
  };
  return employees;
};

export const resolveTechnicianNameAgainstDirectory = async (
  supabase: SupabaseClient,
  query: string,
): Promise<TechnicianNameResolution<NamedEmployee>> =>
  matchEmployeesByName(await getTechnicianDirectory(supabase), query);
