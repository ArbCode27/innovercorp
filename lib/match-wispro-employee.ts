import type { SupabaseClient } from "@supabase/supabase-js";
import { listEmployees } from "./wispro";
import { findEmployeeByDocumentDigits, findEmployeeIdByPhoneLast10 } from "./crm-wispro-casos";
import { documentDigits, phoneLast10 } from "./phone-match";
import { pickWisproEmployeeFromCatalog } from "./pick-wispro-employee";
import type { WisproEmployee } from "./wispro-types";

export type MatchedWisproEmployee = {
  id: string;
  name: string;
  phone: string | null;
  document: string | null;
};

export { pickWisproEmployeeFromCatalog };

const toMatched = (
  employee: Pick<
    WisproEmployee,
    "id" | "name" | "phone" | "phone_mobile" | "national_identification_number"
  >,
): MatchedWisproEmployee => ({
  id: employee.id,
  name: employee.name,
  phone: employee.phone_mobile || employee.phone,
  document: employee.national_identification_number,
});

export const matchWisproEmployee = async (
  supabase: SupabaseClient,
  input: { phone?: string | null; document?: string | null },
): Promise<MatchedWisproEmployee | null> => {
  const document = documentDigits(input.document);
  try {
    const employees = await listEmployees();
    const live = pickWisproEmployeeFromCatalog(employees, {
      phone: input.phone,
      document,
    });
    if (live) return toMatched(live);
  } catch (error) {
    console.warn("[WISPRO] employee_match_catalog_failed", error);
  }

  if (document) {
    const byDocument = await findEmployeeByDocumentDigits(supabase, document);
    if (byDocument) {
      return {
        id: byDocument.id,
        name: byDocument.name,
        phone: byDocument.phone,
        document: byDocument.document,
      };
    }
  }

  const last10 = phoneLast10(input.phone);
  const fallback = await findEmployeeIdByPhoneLast10(supabase, last10);
  if (!fallback) return null;
  return {
    id: fallback.id,
    name: fallback.name,
    phone: input.phone || null,
    document: fallback.document,
  };
};

export const matchWisproEmployeeForPhone = (
  supabase: SupabaseClient,
  phone: string | null | undefined,
) => matchWisproEmployee(supabase, { phone });
