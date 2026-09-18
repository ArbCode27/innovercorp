import type { SupabaseClient } from "@supabase/supabase-js";
import { listEmployees } from "./wispro";
import { findEmployeeIdByPhoneLast10 } from "./crm-wispro-casos";
import { phoneLast10, phonesMatch } from "./phone-match";

export type MatchedWisproEmployee = {
  id: string;
  name: string;
  phone: string | null;
};

export const matchWisproEmployeeForPhone = async (
  supabase: SupabaseClient,
  phone: string | null | undefined,
): Promise<MatchedWisproEmployee | null> => {
  const last10 = phoneLast10(phone);
  if (!last10) return null;

  try {
    const employees = await listEmployees();
    const live = employees.find(
      (employee) =>
        phonesMatch(phone, employee.phone) ||
        phonesMatch(phone, employee.phone_mobile),
    );
    if (live) {
      return {
        id: live.id,
        name: live.name,
        phone: live.phone_mobile || live.phone,
      };
    }
  } catch (error) {
    console.warn("[WISPRO] employee_match_catalog_failed", error);
  }

  const fallback = await findEmployeeIdByPhoneLast10(supabase, last10);
  if (!fallback) return null;
  return { id: fallback.id, name: fallback.name, phone: phone || null };
};
