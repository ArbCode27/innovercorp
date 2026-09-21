import type { SupabaseClient } from "@supabase/supabase-js";
import { getTechnicianDirectory } from "./technician-directory";
import {
  logTechnicianNameMatch,
  matchEmployeesByName,
  type TechnicianNameResolution,
} from "./technician-name-match";
import type { NamedEmployee } from "./ticket-supervisor";

export type TechnicianNameMatch = TechnicianNameResolution<NamedEmployee>;

export const resolveTechnicianByName = async (
  supabase: SupabaseClient,
  name: string,
): Promise<TechnicianNameMatch> => {
  const query = String(name || "").trim();
  const directory = query
    ? await getTechnicianDirectory(supabase)
    : [];
  const result = matchEmployeesByName(directory, query);
  logTechnicianNameMatch(query, result);
  return result;
};
