import { NextRequest, NextResponse } from "next/server";
import { getSupabaseAdmin } from "@/app/api/crm/_lib/supabase-admin";
import {
  listEmployees,
  listHelpDeskCategories,
  listTechnicians,
  WisproHttpError,
} from "@/lib/wispro";
import type { WisproCategory, WisproEmployee } from "@/lib/wispro-types";

export const dynamic = "force-dynamic";

const DEFAULT_CATEGORIES: WisproCategory[] = [
  {
    id: "f47ac10b-58cc-4372-a567-0e02b2c3d479",
    name: "Soporte Técnico / Falla de Servicio",
    level: "Low",
    public_for_mobile: true,
    created_at: "",
    updated_at: "",
  },
  {
    id: "e47ac10b-58cc-4372-a567-0e02b2c3d480",
    name: "Revisión de Fibra Óptica / Potencia",
    level: "Low",
    public_for_mobile: true,
    created_at: "",
    updated_at: "",
  },
  {
    id: "d47ac10b-58cc-4372-a567-0e02b2c3d481",
    name: "Configuración de Router / WiFi",
    level: "Low",
    public_for_mobile: true,
    created_at: "",
    updated_at: "",
  },
  {
    id: "c47ac10b-58cc-4372-a567-0e02b2c3d482",
    name: "Instalación de Servicio",
    level: "Low",
    public_for_mobile: true,
    created_at: "",
    updated_at: "",
  },
  {
    id: "b47ac10b-58cc-4372-a567-0e02b2c3d483",
    name: "Cambio / Reemplazo de Equipo ONU",
    level: "Low",
    public_for_mobile: true,
    created_at: "",
    updated_at: "",
  },
  {
    id: "a47ac10b-58cc-4372-a567-0e02b2c3d484",
    name: "Falla Masiva / Corte General",
    level: "High",
    public_for_mobile: true,
    created_at: "",
    updated_at: "",
  },
];

const catalogEmployees = async (input: {
  includeAll: boolean;
  refresh: boolean;
}) => {
  const supabase = getSupabaseAdmin();
  let query = supabase
    .from("crm_technicians")
    .select("*")
    .order("name", { ascending: true });

  if (!input.includeAll) {
    query = query.eq("active", true);
  }

  const { data: dbTechnicians, error: dbError } = await query;

  if (!dbError && dbTechnicians && dbTechnicians.length > 0) {
    const employees: WisproEmployee[] = dbTechnicians.map((row) => ({
      id: String(row.employee_id || row.id),
      name: String(row.name || "Técnico"),
      phone: (row.phone_e164 as string | null) || (row.phone_last10 as string | null) || null,
      phone_mobile:
        (row.whatsapp_phone_e164 as string | null) ||
        (row.whatsapp_phone_last10 as string | null) ||
        (row.phone_e164 as string | null) ||
        null,
      national_identification_number:
        (row.document as string | null) ||
        (row.document_last4 as string | null) ||
        null,
      public_id: null,
      enabled: row.active !== false,
    }));

    return { employees, allCount: employees.length };
  }

  // Fallback to Wispro API if no local technicians exist yet
  try {
    const technicians = await listTechnicians({ forceRefresh: input.refresh });
    const employees = input.includeAll
      ? await listTechnicians({ includeAll: true, forceRefresh: false })
      : technicians;
    const allCount = (await listEmployees(false)).length;
    return { employees, allCount };
  } catch (error) {
    console.warn("[TECHNICIANS] catalog_fallback_failed", error);
    return { employees: [], allCount: 0 };
  }
};

const safeGetCategories = async (refresh: boolean): Promise<WisproCategory[]> => {
  try {
    const categories = await listHelpDeskCategories(refresh);
    return categories.length ? categories : DEFAULT_CATEGORIES;
  } catch {
    return DEFAULT_CATEGORIES;
  }
};

export async function GET(request: NextRequest) {
  const resource = request.nextUrl.searchParams.get("resource") || "all";
  const refresh = request.nextUrl.searchParams.get("refresh") === "1";
  const includeAllEmployees =
    request.nextUrl.searchParams.get("allEmployees") === "1";

  try {
    if (resource === "categories") {
      const categories = await safeGetCategories(refresh);
      return NextResponse.json({ categories });
    }

    if (resource === "employees") {
      const payload = await catalogEmployees({
        includeAll: includeAllEmployees,
        refresh,
      });
      return NextResponse.json(payload);
    }

    const [categories, employeePayload] = await Promise.all([
      safeGetCategories(refresh),
      catalogEmployees({ includeAll: includeAllEmployees, refresh }),
    ]);

    return NextResponse.json({
      categories,
      ...employeePayload,
    });
  } catch (error) {
    const message =
      error instanceof WisproHttpError
        ? error.message
        : error instanceof Error
          ? error.message
          : "No se pudieron cargar los catálogos";
    const status = error instanceof WisproHttpError ? error.status : 500;
    return NextResponse.json({ error: message }, { status });
  }
}
