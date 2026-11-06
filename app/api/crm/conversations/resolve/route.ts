import { NextRequest, NextResponse } from "next/server";
import { createClient, type SupabaseClient } from "@supabase/supabase-js";
import { z } from "zod";
import { archiveAndDeleteConversation } from "@/app/crm/_lib/conversation-resolve";
import type { Ticket } from "@/app/crm/_lib/types";

const resolveSchema = z
  .object({
    conversationId: z.coerce.number().int().positive().optional(),
    conversationIds: z
      .array(z.coerce.number().int().positive())
      .min(1)
      .optional(),
    resolvedBy: z.coerce.number().int().positive(),
  })
  .refine(
    (data) =>
      data.conversationId !== undefined ||
      (Array.isArray(data.conversationIds) && data.conversationIds.length > 0),
    {
      message: "Debe proporcionar conversationId o conversationIds",
    },
  );

const getServerEnv = (key: string) => {
  const value = process.env[key];

  if (!value) {
    throw new Error(`Missing environment variable: ${key}`);
  }

  return value;
};

const resolveOpenTicketForClient = async (
  supabase: SupabaseClient,
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
    .update({ status: "Resuelto" } as never)
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

    const { conversationId, conversationIds, resolvedBy } = payload.data;
    const isSingle = conversationId !== undefined && !conversationIds;
    const idsToResolve = conversationIds ?? (conversationId ? [conversationId] : []);

    const supabase = createClient(
      getServerEnv("NEXT_PUBLIC_SUPABASE_URL"),
      getServerEnv("SUPABASE_SERVICE_ROLE_KEY"),
    ) as unknown as SupabaseClient;

    const resolvedIds: number[] = [];
    const failedIds: { id: number; error: string }[] = [];
    let lastHistoryId: number | null = null;

    for (const id of idsToResolve) {
      try {
        const { data: conversation, error: conversationError } = await supabase
          .from("conversations")
          .select("id, client_id")
          .eq("id", id)
          .maybeSingle<{ id: number; client_id: number | null }>();

        if (conversationError) {
          throw conversationError;
        }

        if (!conversation) {
          failedIds.push({ id, error: "La conversación no existe" });
          continue;
        }

        const historyId = await archiveAndDeleteConversation(
          supabase,
          id,
          resolvedBy,
        );

        await resolveOpenTicketForClient(supabase, conversation.client_id);
        resolvedIds.push(id);
        lastHistoryId = historyId;
      } catch (err) {
        console.error(`Resolve conversation error for ID ${id}:`, err);
        failedIds.push({
          id,
          error: err instanceof Error ? err.message : "Error al archivar",
        });
      }
    }

    if (isSingle) {
      if (failedIds.length > 0) {
        return NextResponse.json(
          { error: failedIds[0].error },
          { status: 500 },
        );
      }
      return NextResponse.json({ historyId: lastHistoryId });
    }

    return NextResponse.json({
      success: true,
      resolvedCount: resolvedIds.length,
      resolvedIds,
      failedIds,
    });
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
