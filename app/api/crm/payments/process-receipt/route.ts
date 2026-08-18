import { NextRequest, NextResponse, after } from "next/server";
import { createClient } from "@supabase/supabase-js";
import { z } from "zod";
import { replyToConversationWithGemini } from "@/app/api/crm/ai/_lib/reply-to-conversation";

const payloadSchema = z.object({
  messageId: z.coerce.number().int().positive(),
  conversationId: z.coerce.number().int().positive(),
  agentId: z.coerce.number().int().positive(),
});

type DbMessage = {
  id: number;
  conversation_id: number;
  wa_message_id: string | null;
  media_url: string | null;
  media_type: string | null;
  type: string;
  metadata: Record<string, unknown> | null;
};

type DbConversation = {
  id: number;
  client_id: number | null;
  agent_id: number | null;
};

type DbAgent = {
  id: number;
  role: string | null;
};

const getServerEnv = (key: string) => {
  const value = process.env[key];
  if (!value) {
    throw new Error(`Missing environment variable: ${key}`);
  }
  return value;
};

const toNonEmptyString = (value: unknown) => {
  if (typeof value !== "string") return null;
  const trimmed = value.trim();
  return trimmed || null;
};

const readMetadataFlag = (
  metadata: Record<string, unknown> | null,
  key: string,
) => {
  const value = metadata?.[key];
  if (typeof value === "boolean") return value;
  if (typeof value === "string") return value.toLowerCase() === "true";
  return false;
};

export async function POST(req: NextRequest) {
  try {
    const parsedPayload = payloadSchema.safeParse(await req.json());
    if (!parsedPayload.success) {
      return NextResponse.json(
        { error: parsedPayload.error.issues[0]?.message || "Datos inválidos" },
        { status: 400 },
      );
    }

    const { messageId, conversationId, agentId } = parsedPayload.data;

    const supabase = createClient(
      getServerEnv("NEXT_PUBLIC_SUPABASE_URL"),
      getServerEnv("SUPABASE_SERVICE_ROLE_KEY"),
    );

    const { data: agent, error: agentError } = await supabase
      .from("agents")
      .select("id, role")
      .eq("id", agentId)
      .maybeSingle<DbAgent>();

    if (agentError) {
      console.error("Process receipt agent lookup:", agentError);
      return NextResponse.json(
        { error: "No se pudo validar el asesor" },
        { status: 500 },
      );
    }

    if (!agent) {
      return NextResponse.json(
        { error: "El asesor no existe" },
        { status: 404 },
      );
    }

    const isAdmin = String(agent.role || "").toLowerCase() === "admin";

    const { data: conversation, error: conversationError } = await supabase
      .from("conversations")
      .select("id, client_id, agent_id")
      .eq("id", conversationId)
      .maybeSingle<DbConversation>();

    if (conversationError) {
      console.error("Process receipt conversation lookup:", conversationError);
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

    if (
      conversation.agent_id &&
      conversation.agent_id !== agentId &&
      !isAdmin
    ) {
      return NextResponse.json(
        {
          error:
            "Esta conversación está asignada a otro asesor y no puedes procesar su comprobante",
        },
        { status: 403 },
      );
    }

    const { data: message, error: messageError } = await supabase
      .from("messages")
      .select(
        "id, conversation_id, wa_message_id, media_url, media_type, type, metadata",
      )
      .eq("id", messageId)
      .maybeSingle<DbMessage>();

    if (messageError) {
      console.error("Process receipt message lookup:", messageError);
      return NextResponse.json(
        { error: "No se pudo validar el mensaje" },
        { status: 500 },
      );
    }

    if (!message) {
      return NextResponse.json(
        { error: "El mensaje no existe" },
        { status: 404 },
      );
    }

    if (message.conversation_id !== conversationId) {
      return NextResponse.json(
        { error: "El mensaje no pertenece a la conversación indicada" },
        { status: 400 },
      );
    }

    if (message.type !== "in" || message.media_type !== "image") {
      return NextResponse.json(
        { error: "Solo se pueden procesar imágenes enviadas por clientes" },
        { status: 400 },
      );
    }

    const fileUrl = toNonEmptyString(message.media_url);
    if (!fileUrl) {
      return NextResponse.json(
        { error: "La imagen no tiene URL pública disponible" },
        { status: 400 },
      );
    }

    const metadata = (message.metadata || {}) as Record<string, unknown>;
    const alreadyRequested = readMetadataFlag(
      metadata,
      "payment_receipt_requested",
    );

    if (alreadyRequested) {
      return NextResponse.json({
        success: true,
        alreadyProcessed: true,
        messageId: message.id,
        engine: "gemini",
      });
    }

    const nextMetadata: Record<string, unknown> = {
      ...metadata,
      payment_receipt_requested: true,
      payment_receipt_requested_at: new Date().toISOString(),
      payment_receipt_requested_by: agentId,
      payment_receipt_engine: "gemini",
    };

    const { error: updateMessageError } = await supabase
      .from("messages")
      .update({ metadata: nextMetadata })
      .eq("id", message.id);

    if (updateMessageError) {
      console.error(
        "Process receipt update message metadata:",
        updateMessageError,
      );
      return NextResponse.json(
        { error: "No se pudo marcar el comprobante para procesamiento" },
        { status: 500 },
      );
    }

    // Run Gemini after response so the UI stays snappy; forceRun allows human_mode chats.
    after(async () => {
      try {
        const result = await replyToConversationWithGemini(supabase, {
          conversationId,
          triggerMessageId: message.id,
          forceRun: true,
          paymentRequestedByAgentId: agentId,
        });

        console.log("[PROCESS_RECEIPT] gemini_finished", {
          conversationId,
          messageId: message.id,
          ok: result.ok,
          reason: result.reason,
          action: result.action ?? null,
        });
      } catch (error) {
        console.error("[PROCESS_RECEIPT] gemini_failed", {
          conversationId,
          messageId: message.id,
          error: error instanceof Error ? error.message : "unknown_error",
        });
      }
    });

    return NextResponse.json({
      success: true,
      alreadyProcessed: false,
      messageId: message.id,
      engine: "gemini",
      scheduled: true,
    });
  } catch (error) {
    if (
      error instanceof Error &&
      error.message.startsWith("Missing environment")
    ) {
      console.error(error.message);
      return NextResponse.json(
        { error: "CRM no configurado en el servidor" },
        { status: 503 },
      );
    }

    console.error("Process receipt error:", error);
    return NextResponse.json(
      { error: "Error interno al procesar el comprobante" },
      { status: 500 },
    );
  }
}
