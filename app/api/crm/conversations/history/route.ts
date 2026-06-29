import { NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";
import { normalizeConversationHistoryEntry } from "@/app/crm/_lib/conversation-history-utils";
import type { ConversationHistory } from "@/app/crm/_lib/types";

const getServerEnv = (key: string) => {
  const value = process.env[key];

  if (!value) {
    throw new Error(`Missing environment variable: ${key}`);
  }

  return value;
};

export async function GET() {
  try {
    const supabase = createClient(
      getServerEnv("NEXT_PUBLIC_SUPABASE_URL"),
      getServerEnv("SUPABASE_SERVICE_ROLE_KEY"),
    );

    const { data, error } = await supabase
      .from("conversation_history")
      .select("*, history_messages(*)")
      .order("resolved_at", { ascending: false })
      .order("created_at", {
        referencedTable: "history_messages",
        ascending: true,
      });

    if (error) {
      console.error("Load conversation history:", error);
      return NextResponse.json(
        { error: "No se pudo cargar el historial de conversaciones" },
        { status: 500 },
      );
    }

    const entries = ((data || []) as ConversationHistory[]).map(
      normalizeConversationHistoryEntry,
    );

    return NextResponse.json({ entries });
  } catch (error) {
    if (error instanceof Error && error.message.startsWith("Missing environment")) {
      console.error(error.message);
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
