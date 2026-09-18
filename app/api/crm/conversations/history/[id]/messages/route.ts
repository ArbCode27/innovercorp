import { NextRequest, NextResponse } from "next/server";
import { getSupabaseAdmin } from "@/app/api/crm/_lib/supabase-admin";
import { HISTORY_MESSAGE_PAGE_SIZE } from "@/app/crm/_lib/history-query";
import type { HistoryMessage } from "@/app/crm/_lib/types";

export const dynamic = "force-dynamic";

const parsePositiveInt = (value: string, fallback: number) => {
  const parsed = Number.parseInt(value, 10);
  if (!Number.isFinite(parsed) || parsed < 1) return fallback;
  return parsed;
};

export async function GET(
  request: NextRequest,
  context: { params: { id: string } | Promise<{ id: string }> },
) {
  try {
    const { id: rawId } = await Promise.resolve(context.params);
    const historyId = Number.parseInt(rawId, 10);
    if (!Number.isFinite(historyId) || historyId < 1) {
      return NextResponse.json({ error: "Historial inválido" }, { status: 400 });
    }

    const limit = Math.min(
      parsePositiveInt(
        request.nextUrl.searchParams.get("limit") || "",
        HISTORY_MESSAGE_PAGE_SIZE,
      ),
      HISTORY_MESSAGE_PAGE_SIZE,
    );
    const before = request.nextUrl.searchParams.get("before")?.trim() || null;

    const supabase = getSupabaseAdmin();

    const { data: history, error: historyError } = await supabase
      .from("conversation_history")
      .select("id")
      .eq("id", historyId)
      .maybeSingle();

    if (historyError) {
      console.error("Load history messages header:", historyError);
      return NextResponse.json(
        { error: "No se pudieron cargar los mensajes del historial" },
        { status: 500 },
      );
    }

    if (!history) {
      return NextResponse.json({ error: "El historial no existe" }, { status: 404 });
    }

    let query = supabase
      .from("history_messages")
      .select("*")
      .eq("history_id", historyId)
      .order("created_at", { ascending: false })
      .order("id", { ascending: false })
      .limit(limit + 1);

    if (before) {
      query = query.lt("created_at", before);
    }

    const { data, error } = await query;

    if (error) {
      console.error("Load history messages:", error);
      return NextResponse.json(
        { error: "No se pudieron cargar los mensajes del historial" },
        { status: 500 },
      );
    }

    const rows = (data || []) as HistoryMessage[];
    const hasMore = rows.length > limit;
    const page = hasMore ? rows.slice(0, limit) : rows;
    const messages = [...page].reverse();

    return NextResponse.json({ messages, hasMore });
  } catch (error) {
    const message =
      error instanceof Error
        ? error.message
        : "No se pudieron cargar los mensajes del historial";
    console.error("History messages error:", error);
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
