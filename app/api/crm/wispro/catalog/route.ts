import { NextRequest, NextResponse } from "next/server";
import { getSupabaseAdmin } from "@/app/api/crm/_lib/supabase-admin";
import { syncCrmTechnicians } from "@/lib/crm-technicians";
import {
  listEmployees,
  listHelpDeskCategories,
  listTechnicians,
  WisproHttpError,
} from "@/lib/wispro";

export const dynamic = "force-dynamic";

export async function GET(request: NextRequest) {
  const resource = request.nextUrl.searchParams.get("resource") || "all";
  const refresh = request.nextUrl.searchParams.get("refresh") === "1";
  const includeAllEmployees =
    request.nextUrl.searchParams.get("allEmployees") !== "0";

  try {
    if (resource === "categories") {
      const categories = await listHelpDeskCategories(refresh);
      return NextResponse.json({ categories });
    }

    if (resource === "employees") {
      const employees = await listTechnicians({
        includeAll: includeAllEmployees,
        forceRefresh: refresh,
      });
      const allCount = includeAllEmployees
        ? employees.length
        : (await listEmployees(false)).length;
      void syncCrmTechnicians(getSupabaseAdmin(), {
        employees,
        forceRefresh: refresh,
      }).catch((error) => {
        console.warn("[TECHNICIANS] catalog_sync_failed", error);
      });
      return NextResponse.json({ employees, allCount });
    }

    const [categories, employees, allEmployees] = await Promise.all([
      listHelpDeskCategories(refresh),
      listTechnicians({
        includeAll: includeAllEmployees,
        forceRefresh: refresh,
      }),
      listEmployees(refresh),
    ]);

    void syncCrmTechnicians(getSupabaseAdmin(), {
      employees: includeAllEmployees ? allEmployees : employees,
      forceRefresh: refresh,
    }).catch((error) => {
      console.warn("[TECHNICIANS] catalog_sync_failed", error);
    });

    return NextResponse.json({
      categories,
      employees,
      allCount: allEmployees.length,
    });
  } catch (error) {
    const message =
      error instanceof WisproHttpError
        ? error.message
        : error instanceof Error
          ? error.message
          : "No se pudieron cargar los catálogos de Wispro";
    const status = error instanceof WisproHttpError ? error.status : 502;
    return NextResponse.json({ error: message }, { status });
  }
}
