import { NextRequest, NextResponse } from "next/server";
import { createClient, type SupabaseClient } from "@supabase/supabase-js";
import { getSupabaseAdmin } from "../_lib/supabase-admin";
import {
  fetchPerformanceDashboardData,
  type PerformancePeriod,
} from "@/lib/crm-performance";

export const dynamic = "force-dynamic";

const getClient = (): SupabaseClient => {
  try {
    return getSupabaseAdmin();
  } catch {
    const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
    const anonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;
    if (!url || !anonKey) {
      throw new Error("Supabase credentials not configured");
    }
    return createClient(url, anonKey);
  }
};

export async function GET(request: NextRequest) {
  try {
    const periodParam = request.nextUrl.searchParams.get("period") || "month";
    const allowedPeriods: PerformancePeriod[] = [
      "month",
      "last_month",
      "week",
      "all",
    ];
    const period: PerformancePeriod = allowedPeriods.includes(
      periodParam as PerformancePeriod,
    )
      ? (periodParam as PerformancePeriod)
      : "month";

    const supabase = getClient();
    const data = await fetchPerformanceDashboardData(supabase, period);

    return NextResponse.json(data);
  } catch (error) {
    console.error("Performance API error:", error);
    const message =
      error instanceof Error ? error.message : "Error al calcular métricas de rendimiento";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
