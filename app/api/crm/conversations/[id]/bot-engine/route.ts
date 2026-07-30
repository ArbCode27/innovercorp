import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { createClient } from "@supabase/supabase-js";
import { isBotEngine } from "../../../_lib/bot-engine";

const payloadSchema = z.object({
  bot_engine: z.union([z.enum(["gemini", "make"]), z.null()]),
  agent_id: z.coerce.number().int().positive().optional(),
});

type RouteContext = {
  params: Promise<{ id: string }>;
};

const getAnonClient = () => {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const anonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;
  if (!url || !anonKey) {
    throw new Error("Supabase no configurado");
  }
  return createClient(url, anonKey);
};

export async function PATCH(req: NextRequest, context: RouteContext) {
  try {
    const { id } = await context.params;
    const conversationId = Number(id);
    if (!Number.isFinite(conversationId) || conversationId <= 0) {
      return NextResponse.json(
        { error: "conversation id inválido" },
        { status: 400 },
      );
    }

    const payload = payloadSchema.safeParse(await req.json());
    if (!payload.success) {
      return NextResponse.json(
        { error: payload.error.issues[0]?.message || "Datos inválidos" },
        { status: 400 },
      );
    }

    if (
      payload.data.bot_engine !== null &&
      !isBotEngine(payload.data.bot_engine)
    ) {
      return NextResponse.json(
        { error: "Motor de bot inválido" },
        { status: 400 },
      );
    }

    const supabase = getAnonClient();
    const { data, error } = await supabase
      .from("conversations")
      .update({
        bot_engine: payload.data.bot_engine,
        updated_at: new Date().toISOString(),
      })
      .eq("id", conversationId)
      .select("*")
      .maybeSingle();

    if (error) {
      console.error("[CONVERSATION_BOT_ENGINE] update_failed", error);
      return NextResponse.json(
        { error: "No se pudo actualizar el motor de la conversación" },
        { status: 500 },
      );
    }

    if (!data) {
      return NextResponse.json(
        { error: "Conversación no encontrada" },
        { status: 404 },
      );
    }

    return NextResponse.json({ conversation: data });
  } catch (error) {
    console.error("[CONVERSATION_BOT_ENGINE] unexpected_error", error);
    return NextResponse.json(
      { error: "Error interno al actualizar el motor" },
      { status: 500 },
    );
  }
}
