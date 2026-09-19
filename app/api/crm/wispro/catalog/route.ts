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

const catalogEmployees = async (input: {
  includeAll: boolean;
  refresh: boolean;
}) => {
  const technicians = await listTechnicians({ forceRefresh: input.refresh });
  const employees = input.includeAll
    ? await listTechnicians({ includeAll: true, forceRefresh: false })
    : technicians;
  const allCount = (await listEmployees(false)).length;
  void syncCrmTechnicians(getSupabaseAdmin(), {
    employees: technicians,
    forceRefresh: input.refresh,
  }).catch((error) => {
    console.warn("[TECHNICIANS] catalog_sync_failed", error);
  });
  return { employees, allCount };
};

export async function GET(request: NextRequest) {
  const resource = request.nextUrl.searchParams.get("resource") || "all";
  const refresh = request.nextUrl.searchParams.get("refresh") === "1";
  const includeAllEmployees =
    request.nextUrl.searchParams.get("allEmployees") === "1";

  try {
    if (resource === "categories") {
      const categories = await listHelpDeskCategories(refresh);
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
      listHelpDeskCategories(refresh),
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
          : "No se pudieron cargar los catálogos de Wispro";
    const status = error instanceof WisproHttpError ? error.status : 502;
    return NextResponse.json({ error: message }, { status });
  }
}
