import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";
import { z } from "zod";
import { archiveAndDeleteConversation } from "@/app/crm/_lib/conversation-resolve";
import type { Ticket } from "@/app/crm/_lib/types";

const resolveSchema = z.object({
  conversationId: z.coerce.number().int().positive(),
  resolvedBy: z.coerce.number().int().positive(),
});

const getServerEnv = (key: string) => {
  const value = process.env[key];

  if (!value) {
    throw new Error(`Missing environment variable: ${key}`);
  }

  return value;
};

const resolveOpenTicketForClient = async (
  supabase: ReturnType<typeof createClient>,
  clientId: number | null,
) => {
  if (!clientId) return;

  const { data } = await supabase
    .from("tickets")
    .select("*")
    .eq("client_id", clientId)
    .neq("status", "Resuelto")
    .limit(1)
    .maybeSingle<Ticket>();

  if (!data) return;

  const { error } = await supabase
    .from("tickets")
    .update({ status: "Resuelto" })
    .eq("id", data.id);

  if (error) {
    throw error;
  }
};

export async function POST(req: NextRequest) {
  try {
    const payload = resolveSchema.safeParse(await req.json());

    if (!payload.success) {
      return NextResponse.json(
        { error: payload.error.issues[0]?.message || "Datos inválidos" },
        { status: 400 },
      );
    }

    const { conversationId, resolvedBy } = payload.data;

    const supabase = createClient(
      getServerEnv("NEXT_PUBLIC_SUPABASE_URL"),
      getServerEnv("SUPABASE_SERVICE_ROLE_KEY"),
    );

    const { data: conversation, error: conversationError } = await supabase
      .from("conversations")
      .select("id, client_id")
      .eq("id", conversationId)
      .maybeSingle<{ id: number; client_id: number | null }>();

    if (conversationError) {
      console.error("Resolve conversation lookup:", conversationError);
      return NextResponse.json(
        { error: "No se pudo validar la conversación" },
        { status: 500 },
      );
    }

    if (!conversation) {
      return NextResponse.json(
        { error: "La conversación no existe" },
        { status: 404 },
      );
    }

    const historyId = await archiveAndDeleteConversation(
      supabase,
      conversationId,
      resolvedBy,
    );

    await resolveOpenTicketForClient(supabase, conversation.client_id);

    return NextResponse.json({ historyId });
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
        : "No se pudo archivar la conversación";

    console.error("Resolve conversation error:", error);

    return NextResponse.json({ error: message }, { status: 500 });
  }
}
