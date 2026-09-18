import { NextRequest, NextResponse } from "next/server";
import { getSupabaseAdmin } from "@/app/api/crm/_lib/supabase-admin";
import { normalizeConversationHistoryEntry } from "@/app/crm/_lib/conversation-history-utils";
import {
  escapeIlike,
  historyListRangeIso,
  parseHistoryListQuery,
} from "@/app/crm/_lib/history-query";
import type { ConversationHistory } from "@/app/crm/_lib/types";

export const dynamic = "force-dynamic";

export async function GET(request: NextRequest) {
  try {
    const query = parseHistoryListQuery(request.nextUrl.searchParams);
    const range = historyListRangeIso(query);
    const supabase = getSupabaseAdmin();

    let requestQuery = supabase
      .from("conversation_history")
      .select("*", { count: "exact" })
      .order("resolved_at", { ascending: false })
      .order("id", { ascending: false })
      .range(query.offset, query.offset + query.limit - 1);

    if (range.gte) {
      requestQuery = requestQuery.gte("resolved_at", range.gte);
    }
    if (range.lte) {
      requestQuery = requestQuery.lte("resolved_at", range.lte);
    }
    if (query.q) {
      const term = escapeIlike(query.q);
      requestQuery = requestQuery.or(
        [
          `client_name.ilike.%${term}%`,
          `client_phone.ilike.%${term}%`,
          `summary.ilike.%${term}%`,
        ].join(","),
      );
    }

    const { data, error, count } = await requestQuery;

    if (error) {
      console.error("Load conversation history:", error);
      return NextResponse.json(
        { error: "No se pudo cargar el historial de conversaciones" },
        { status: 500 },
      );
    }

    const entries = ((data || []) as ConversationHistory[]).map((entry) =>
      normalizeConversationHistoryEntry({
        ...entry,
        history_messages: undefined,
      }),
    );

    return NextResponse.json({
      entries,
      total: count ?? entries.length,
      limit: query.limit,
      offset: query.offset,
    });
  } catch (error) {
    if (error instanceof Error && error.message.includes("not configured")) {
      return NextResponse.json(
        { error: "CRM no configurado en el servidor" },
        { status: 503 },
      );
    }

    const message =
      error instanceof Error
        ? error.message
        : "No se pudo cargar el historial de conversaciones";

    console.error("Conversation history error:", error);
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
