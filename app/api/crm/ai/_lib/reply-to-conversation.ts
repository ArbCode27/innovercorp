import type { SupabaseClient } from "@supabase/supabase-js";
import { getCrmSettings } from "../../_lib/crm-settings";
import {
  generateGeminiText,
  parseGeminiReplyDecision,
} from "./gemini";

const LOG_PREFIX = "[CRM_AI_REPLY]";
const GRAPH_API_VERSION = "v19.0";
const HISTORY_LIMIT = 16;

const DEFAULT_SYSTEM_PROMPT = `Eres el asistente virtual de Fibra Óptica Innover (ISP en Venezuela).
Responde en español, de forma breve, clara y profesional por WhatsApp.
No inventes precios, fechas de visita, saldos ni estados de cuenta.
Si el cliente pide un humano, reporta un problema técnico grave, habla de pagos complejos o no tienes datos suficientes, usa action=handoff.
Devuelve SOLO JSON válido con esta forma:
{"action":"reply"|"handoff","message":"texto para el cliente","reason":"motivo breve"}`;

type ConversationRow = {
  id: number;
  client_id: number | null;
  human_mode: boolean | null;
  customer_phone: string | null;
  status: string | null;
  bot_engine: string | null;
};

type ClientRow = {
  id: number;
  name: string | null;
  phone: string | null;
  whatsapp_id: string | null;
  plan: string | null;
  zone: string | null;
  account: string | null;
};

type MessageRow = {
  id: number;
  type: string | null;
  content: string | null;
  sender_type: string | null;
  created_at: string | null;
};

const normalizePhone = (value: string) => value.replace(/\D/g, "");

const getServerEnv = (key: string) => {
  const value = process.env[key];
  if (!value) throw new Error(`Missing environment variable: ${key}`);
  return value;
};

const resolveRecipient = (
  conversation: ConversationRow,
  client: ClientRow | null,
) => {
  const candidates = [
    conversation.customer_phone,
    client?.whatsapp_id,
    client?.phone,
  ]
    .map((value) => normalizePhone(String(value || "")))
    .filter((value) => value.length >= 8 && value.length <= 15);

  return candidates[0] || null;
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
    throw new Error(data.error?.message || "Error al enviar a WhatsApp");
  }

  return String(data.messages?.[0]?.id || "") || null;
};

export type AiReplyResult = {
  ok: boolean;
  skipped?: boolean;
  reason: string;
  action?: "reply" | "handoff";
  messageId?: number | null;
};

export const replyToConversationWithGemini = async (
  supabase: SupabaseClient,
  input: {
    conversationId: number;
    triggerMessageId?: number | null;
  },
): Promise<AiReplyResult> => {
  const { data: conversation, error: conversationError } = await supabase
    .from("conversations")
    .select("id, client_id, human_mode, customer_phone, status, bot_engine")
    .eq("id", input.conversationId)
    .maybeSingle<ConversationRow>();

  if (conversationError) throw conversationError;
  if (!conversation) {
    return { ok: false, skipped: true, reason: "conversation_not_found" };
  }

  if (conversation.status === "resuelto") {
    return { ok: false, skipped: true, reason: "conversation_resolved" };
  }

  if (Boolean(conversation.human_mode)) {
    return { ok: false, skipped: true, reason: "human_mode_active" };
  }

  const settings = await getCrmSettings(supabase);
  let client: ClientRow | null = null;

  if (conversation.client_id) {
    const { data: clientRow, error: clientError } = await supabase
      .from("clients")
      .select("id, name, phone, whatsapp_id, plan, zone, account")
      .eq("id", conversation.client_id)
      .maybeSingle<ClientRow>();

    if (clientError) throw clientError;
    client = clientRow;
  }

  const { data: history, error: historyError } = await supabase
    .from("messages")
    .select("id, type, content, sender_type, created_at")
    .eq("conversation_id", conversation.id)
    .order("created_at", { ascending: false })
    .limit(HISTORY_LIMIT);

  if (historyError) throw historyError;

  const chronological = ([...(history || [])] as MessageRow[]).reverse();
  const latestInbound = [...chronological]
    .reverse()
    .find((message) => message.type === "in");

  if (!latestInbound?.content?.trim()) {
    return { ok: false, skipped: true, reason: "no_inbound_text" };
  }

  const contextLines = [
    `Cliente: ${client?.name || "Desconocido"}`,
    `Plan: ${client?.plan || "N/D"}`,
    `Zona: ${client?.zone || "N/D"}`,
    `Estado cuenta: ${client?.account || "N/D"}`,
    `Teléfono chat: ${conversation.customer_phone || client?.whatsapp_id || client?.phone || "N/D"}`,
  ].join("\n");

  const contents = chronological
    .filter((message) => Boolean(message.content?.trim()))
    .map((message) => {
      const isUser = message.type === "in" || message.sender_type === "client";
      return {
        role: isUser ? ("user" as const) : ("model" as const),
        parts: [{ text: String(message.content).trim() }],
      };
    });

  // Gemini requires the first content role to be "user"
  while (contents.length > 0 && contents[0].role !== "user") {
    contents.shift();
  }

  if (contents.length === 0) {
    return { ok: false, skipped: true, reason: "empty_history" };
  }

  const systemPrompt = [
    settings.ai_system_prompt?.trim() || DEFAULT_SYSTEM_PROMPT,
    "",
    "Contexto del cliente:",
    contextLines,
  ].join("\n");

  console.log(`${LOG_PREFIX} generating`, {
    conversationId: conversation.id,
    triggerMessageId: input.triggerMessageId ?? null,
    model: settings.gemini_model,
  });

  const generated = await generateGeminiText({
    systemPrompt,
    contents,
    model: settings.gemini_model,
  });

  console.log(`${LOG_PREFIX} gemini_raw_text`, {
    conversationId: conversation.id,
    triggerMessageId: input.triggerMessageId ?? null,
    text: generated.text,
  });

  const decision = parseGeminiReplyDecision(generated.text);

  console.log(`${LOG_PREFIX} gemini_decision`, {
    conversationId: conversation.id,
    action: decision.action,
    message: decision.message,
    reason: decision.reason ?? null,
  });

  // Re-check human_mode right before acting (race with takeControl)
  const { data: freshConversation, error: freshError } = await supabase
    .from("conversations")
    .select("id, human_mode, customer_phone, client_id, status")
    .eq("id", conversation.id)
    .maybeSingle<ConversationRow>();

  if (freshError) throw freshError;
  if (!freshConversation || Boolean(freshConversation.human_mode)) {
    return { ok: false, skipped: true, reason: "human_mode_active_before_send" };
  }

  if (decision.action === "handoff") {
    await supabase
      .from("conversations")
      .update({
        human_mode: true,
        updated_at: new Date().toISOString(),
      })
      .eq("id", conversation.id);

    const handoffText = decision.message.trim();
    if (handoffText) {
      const to = resolveRecipient(freshConversation, client);
      if (to) {
        try {
          const waMessageId = await sendWhatsAppText(to, handoffText);
          const now = new Date().toISOString();
          const { data: saved } = await supabase
            .from("messages")
            .insert({
              conversation_id: conversation.id,
              wa_message_id: waMessageId,
              type: "out",
              content: handoffText,
              sender_type: "bot",
              sent_by: "Bot IA",
              status: "sent",
              created_at: now,
              metadata: {
                engine: "gemini",
                action: "handoff",
                reason: decision.reason || null,
                trigger_message_id: input.triggerMessageId ?? null,
              },
            })
            .select("id")
            .single();

          await supabase
            .from("conversations")
            .update({
              preview: handoffText,
              updated_at: now,
              last_message_at: now,
            })
            .eq("id", conversation.id);

          console.log(`${LOG_PREFIX} handoff_sent`, {
            conversationId: conversation.id,
            messageId: saved?.id ?? null,
            reason: decision.reason || null,
          });

          return {
            ok: true,
            reason: "handoff",
            action: "handoff",
            messageId: saved?.id ?? null,
          };
        } catch (error) {
          console.error(`${LOG_PREFIX} handoff_send_failed`, error);
        }
      }
    }

    return {
      ok: true,
      reason: decision.reason || "handoff",
      action: "handoff",
    };
  }

  const replyText = decision.message.trim();
  if (!replyText) {
    return { ok: false, skipped: true, reason: "empty_model_reply" };
  }

  const to = resolveRecipient(freshConversation, client);
  if (!to) {
    return { ok: false, skipped: true, reason: "missing_recipient_phone" };
  }

  const waMessageId = await sendWhatsAppText(to, replyText);
  const now = new Date().toISOString();

  const { data: savedMessage, error: saveError } = await supabase
    .from("messages")
    .insert({
      conversation_id: conversation.id,
      wa_message_id: waMessageId,
      type: "out",
      content: replyText,
      sender_type: "bot",
      sent_by: "Bot IA",
      status: "sent",
      created_at: now,
      metadata: {
        engine: "gemini",
        action: "reply",
        reason: decision.reason || null,
        trigger_message_id: input.triggerMessageId ?? null,
      },
    })
    .select("id")
    .single();

  if (saveError) throw saveError;

  await supabase
    .from("conversations")
    .update({
      preview: replyText,
      updated_at: now,
      last_message_at: now,
    })
    .eq("id", conversation.id);

  console.log(`${LOG_PREFIX} reply_sent`, {
    conversationId: conversation.id,
    messageId: savedMessage?.id ?? null,
  });

  return {
    ok: true,
    reason: "reply_sent",
    action: "reply",
    messageId: savedMessage?.id ?? null,
  };
};
