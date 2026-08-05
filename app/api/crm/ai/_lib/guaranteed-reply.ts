import type { SupabaseClient } from "@supabase/supabase-js";
import { ensureConversationLabel } from "@/app/api/crm/_lib/conversation-labels";
import type { AgentHistoryMessage } from "./context-builder";

const LOG_PREFIX = "[AI_FALLBACK]";
const GRAPH_API_VERSION = "v19.0";

const normalizePhone = (value: string) => value.replace(/\D/g, "");

const getServerEnv = (key: string) => {
  const value = process.env[key];
  if (!value) throw new Error(`Missing environment variable: ${key}`);
  return value;
};

const sendWhatsAppText = async (to: string, message: string) => {
  const response = await fetch(
    `https://graph.facebook.com/${GRAPH_API_VERSION}/${getServerEnv(
      "WHATSAPP_PHONE_NUMBER_ID",
    )}/messages`,
    {
      method: "POST",
      headers: {
        Authorization: `Bearer ${getServerEnv("WHATSAPP_TOKEN")}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        messaging_product: "whatsapp",
        recipient_type: "individual",
        to,
        type: "text",
        text: { body: message },
      }),
    },
  );

  const data = await response.json();
  if (!response.ok || data.error) {
    console.error(`${LOG_PREFIX} whatsapp_send_failed`, {
      to,
      status: response.status,
      error: data.error || data,
    });
    throw new Error(data.error?.message || "Error al enviar fallback a WhatsApp");
  }

  const waMessageId = String(data.messages?.[0]?.id || "").trim();
  if (!waMessageId) {
    throw new Error("WhatsApp no devolvió message id para el fallback");
  }

  return waMessageId;
};

const looksLikeCedula = (value: string | null | undefined) => {
  const digits = String(value || "").replace(/\D/g, "");
  return digits.length >= 5 && digits.length <= 12 && /^\d+$/.test(digits);
};

const recentInboundHasImage = (messages: AgentHistoryMessage[]) =>
  messages.some(
    (message) =>
      (message.type === "in" || message.sender_type === "client") &&
      String(message.media_type || "").toLowerCase() === "image",
  );

export const buildFallbackClientMessage = (input: {
  latestInbound?: AgentHistoryMessage | null;
  messages?: AgentHistoryMessage[];
}) => {
  const content = String(input.latestInbound?.content || "").trim();
  const hasImage =
    String(input.latestInbound?.media_type || "").toLowerCase() === "image" ||
    recentInboundHasImage(input.messages || []);

  if (looksLikeCedula(content) && hasImage) {
    return "Recibí tu cédula y tu comprobante. Tuve una demora técnica al procesarlos; un asesor continuará contigo en breve 😊";
  }

  if (looksLikeCedula(content)) {
    return "Recibí tu cédula. Tuve un problema técnico al procesarla; un asesor continuará contigo en breve 😊";
  }

  if (hasImage) {
    return "Recibí tu mensaje/comprobante. Estoy teniendo una demora técnica; un asesor te atenderá en breve. Si aún no enviaste tu cédula, indícamela por aquí 😊";
  }

  return "Disculpa la demora. Un asesor te atenderá en breve por este chat 😊";
};

export type GuaranteedReplyResult = {
  ok: boolean;
  reason: string;
  messageId?: number | null;
  skipped?: boolean;
};

/**
 * Last-resort path: message the client first, then hand off.
 * Never marks human_mode on empty conversations.
 */
export const sendGuaranteedClientReply = async (
  supabase: SupabaseClient,
  input: {
    conversationId: number;
    triggerMessageId?: number | null;
    customerPhone?: string | null;
    whatsappId?: string | null;
    clientPhone?: string | null;
    latestInbound?: AgentHistoryMessage | null;
    messages?: AgentHistoryMessage[];
    errorMessage?: string | null;
  },
): Promise<GuaranteedReplyResult> => {
  const { data: conversation, error: conversationError } = await supabase
    .from("conversations")
    .select("id, human_mode, customer_phone, client_id, status")
    .eq("id", input.conversationId)
    .maybeSingle();

  if (conversationError) {
    console.error(`${LOG_PREFIX} conversation_lookup_failed`, {
      conversationId: input.conversationId,
      error: conversationError.message,
    });
    return { ok: false, reason: "conversation_lookup_failed" };
  }

  if (!conversation) {
    return { ok: false, skipped: true, reason: "conversation_not_found" };
  }

  if (conversation.status === "resuelto") {
    return { ok: false, skipped: true, reason: "conversation_resolved" };
  }

  const { count: messageCount, error: countError } = await supabase
    .from("messages")
    .select("id", { count: "exact", head: true })
    .eq("conversation_id", input.conversationId);

  if (countError) {
    console.error(`${LOG_PREFIX} message_count_failed`, {
      conversationId: input.conversationId,
      error: countError.message,
    });
    return { ok: false, reason: "message_count_failed" };
  }

  // Do not escalate orphan/empty conversations created by failed webhook inserts.
  if ((messageCount ?? 0) === 0 && !input.triggerMessageId) {
    console.warn(`${LOG_PREFIX} skipped_empty_conversation`, {
      conversationId: input.conversationId,
    });
    return { ok: false, skipped: true, reason: "empty_conversation" };
  }

  const to =
    [
      input.customerPhone,
      conversation.customer_phone,
      input.whatsappId,
      input.clientPhone,
    ]
      .map((value) => normalizePhone(String(value || "")))
      .find((value) => value.length >= 8 && value.length <= 15) || null;

  if (!to) {
    console.error(`${LOG_PREFIX} missing_recipient`, {
      conversationId: input.conversationId,
    });
    return { ok: false, reason: "missing_recipient" };
  }

  const message = buildFallbackClientMessage({
    latestInbound: input.latestInbound,
    messages: input.messages,
  });

  const hasImage =
    String(input.latestInbound?.media_type || "").toLowerCase() === "image" ||
    recentInboundHasImage(input.messages || []);

  try {
    const waMessageId = await sendWhatsAppText(to, message);
    const now = new Date().toISOString();

    const { data: saved, error: saveError } = await supabase
      .from("messages")
      .insert({
        conversation_id: input.conversationId,
        wa_message_id: waMessageId,
        type: "out",
        content: message,
        sender_type: "bot",
        sent_by: "Bot IA",
        status: "sent",
        created_at: now,
        metadata: {
          engine: "gemini",
          action: "handoff",
          reason: "ai_guaranteed_fallback",
          ai_fallback: true,
          ai_error: input.errorMessage || null,
          trigger_message_id: input.triggerMessageId ?? null,
        },
      })
      .select("id")
      .single();

    if (saveError) {
      console.error(`${LOG_PREFIX} message_persist_failed`, {
        conversationId: input.conversationId,
        error: saveError.message,
      });
      return { ok: false, reason: "fallback_persist_failed" };
    }

    await supabase
      .from("conversations")
      .update({
        human_mode: true,
        preview: message,
        updated_at: now,
        last_message_at: now,
      })
      .eq("id", input.conversationId);

    await ensureConversationLabel(
      supabase,
      input.conversationId,
      hasImage ? "verificar_pago" : "soporte",
    );

    if (input.triggerMessageId) {
      const { data: trigger } = await supabase
        .from("messages")
        .select("id, metadata")
        .eq("id", input.triggerMessageId)
        .maybeSingle();

      if (trigger) {
        const metadata =
          trigger.metadata && typeof trigger.metadata === "object"
            ? { ...(trigger.metadata as Record<string, unknown>) }
            : {};
        await supabase
          .from("messages")
          .update({
            metadata: {
              ...metadata,
              ai_fallback: true,
              ai_fallback_at: now,
              ai_error: input.errorMessage || null,
            },
          })
          .eq("id", trigger.id);
      }
    }

    console.log(`${LOG_PREFIX} sent`, {
      conversationId: input.conversationId,
      messageId: saved?.id ?? null,
      to,
      hasImage,
      willReplyToClient: true,
    });

    return {
      ok: true,
      reason: "fallback_sent",
      messageId: saved?.id ?? null,
    };
  } catch (error) {
    console.error(`${LOG_PREFIX} failed`, {
      conversationId: input.conversationId,
      error: error instanceof Error ? error.message : "unknown_error",
    });
    return {
      ok: false,
      reason: "fallback_send_failed",
    };
  }
};
