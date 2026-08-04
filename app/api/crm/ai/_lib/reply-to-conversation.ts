import type { SupabaseClient } from "@supabase/supabase-js";
import { getCrmSettings } from "../../_lib/crm-settings";
import type { AgentHistoryMessage } from "./context-builder";
import { runGeminiAgent, type AgentClientSnapshot } from "./agent-runner";

const LOG_PREFIX = "[CRM_AI_REPLY]";
const GRAPH_API_VERSION = "v19.0";
const HISTORY_LIMIT = 24;

type ConversationRow = {
  id: number;
  client_id: number | null;
  human_mode: boolean | null;
  customer_phone: string | null;
  status: string | null;
  bot_engine: string | null;
};

const normalizePhone = (value: string) => value.replace(/\D/g, "");

const getServerEnv = (key: string) => {
  const value = process.env[key];
  if (!value) throw new Error(`Missing environment variable: ${key}`);
  return value;
};

const logGeminiNoReply = (
  kind: "skipped" | "failed",
  details: Record<string, unknown>,
) => {
  const payload = {
    ...details,
    willReplyToClient: false,
  };

  if (kind === "failed") {
    console.error(`${LOG_PREFIX} gemini_no_reply`, payload);
    return;
  }

  console.warn(`${LOG_PREFIX} gemini_no_reply`, payload);
};

const resolveRecipient = (
  conversation: ConversationRow,
  client: AgentClientSnapshot | null,
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
    console.error(`${LOG_PREFIX} whatsapp_send_failed`, {
      to,
      status: response.status,
      error: data.error || data,
    });
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
  runId?: string;
};

export const replyToConversationWithGemini = async (
  supabase: SupabaseClient,
  input: {
    conversationId: number;
    triggerMessageId?: number | null;
  },
): Promise<AiReplyResult> => {
  const baseContext = {
    conversationId: input.conversationId,
    triggerMessageId: input.triggerMessageId ?? null,
  };

  console.log(`${LOG_PREFIX} started`, baseContext);

  try {
    const { data: conversation, error: conversationError } = await supabase
      .from("conversations")
      .select("id, client_id, human_mode, customer_phone, status, bot_engine")
      .eq("id", input.conversationId)
      .maybeSingle<ConversationRow>();

    if (conversationError) throw conversationError;
    if (!conversation) {
      const result = {
        ok: false,
        skipped: true,
        reason: "conversation_not_found",
      } as const;
      logGeminiNoReply("skipped", { ...baseContext, ...result });
      return result;
    }

    if (conversation.status === "resuelto") {
      const result = {
        ok: false,
        skipped: true,
        reason: "conversation_resolved",
      } as const;
      logGeminiNoReply("skipped", {
        ...baseContext,
        ...result,
        status: conversation.status,
      });
      return result;
    }

    if (Boolean(conversation.human_mode)) {
      const result = {
        ok: false,
        skipped: true,
        reason: "human_mode_active",
      } as const;
      logGeminiNoReply("skipped", {
        ...baseContext,
        ...result,
        humanMode: true,
      });
      return result;
    }

    const settings = await getCrmSettings(supabase);
    let client: AgentClientSnapshot | null = null;

    if (conversation.client_id) {
      const { data: clientRow, error: clientError } = await supabase
        .from("clients")
        .select(
          "id, name, phone, whatsapp_id, wa_name, plan, zone, account, wispro_id",
        )
        .eq("id", conversation.client_id)
        .maybeSingle<AgentClientSnapshot>();

      if (clientError) throw clientError;
      client = clientRow;
    }

    const { data: history, error: historyError } = await supabase
      .from("messages")
      .select(
        "id, type, content, sender_type, created_at, media_url, media_type, mime_type, caption, metadata",
      )
      .eq("conversation_id", conversation.id)
      .order("created_at", { ascending: false })
      .limit(HISTORY_LIMIT);

    if (historyError) throw historyError;

    const chronological = ([...(history || [])] as AgentHistoryMessage[]).reverse();
    const latestInbound = [...chronological]
      .reverse()
      .find((message) => message.type === "in" || message.sender_type === "client");

    const hasInboundSignal = Boolean(
      latestInbound &&
        (latestInbound.content?.trim() ||
          latestInbound.media_url ||
          latestInbound.caption?.trim()),
    );

    if (!hasInboundSignal) {
      const result = {
        ok: false,
        skipped: true,
        reason: "no_inbound_content",
      } as const;
      logGeminiNoReply("skipped", {
        ...baseContext,
        ...result,
        historyCount: chronological.length,
      });
      return result;
    }

    console.log(`${LOG_PREFIX} generating`, {
      ...baseContext,
      model: settings.gemini_model,
      historyCount: chronological.length,
      linkedWispro: Boolean(client?.wispro_id),
      latestInboundPreview: latestInbound?.content?.slice(0, 120) ?? null,
      latestMediaType: latestInbound?.media_type ?? null,
    });

    let decision;
    try {
      decision = await runGeminiAgent({
        supabase,
        conversationId: conversation.id,
        customerPhone: conversation.customer_phone,
        client,
        messages: chronological,
        triggerMessageId: input.triggerMessageId,
        businessPrompt: settings.ai_system_prompt,
        model: settings.gemini_model,
      });
    } catch (geminiError) {
      const message =
        geminiError instanceof Error
          ? geminiError.message
          : "gemini_request_failed";

      if (message === "empty_history") {
        const result = {
          ok: false,
          skipped: true,
          reason: "empty_history",
        } as const;
        logGeminiNoReply("skipped", { ...baseContext, ...result });
        return result;
      }

      logGeminiNoReply("failed", {
        ...baseContext,
        reason: "gemini_api_error",
        model: settings.gemini_model,
        error: message,
      });
      throw geminiError;
    }

    console.log(`${LOG_PREFIX} gemini_decision`, {
      ...baseContext,
      action: decision.action,
      message: decision.message,
      reason: decision.reason ?? null,
      runId: decision.runId,
      clientId: decision.clientId,
    });

    // Refresh client after possible Wispro link.
    if (decision.clientId && decision.clientId !== client?.id) {
      const { data: linkedClient } = await supabase
        .from("clients")
        .select(
          "id, name, phone, whatsapp_id, wa_name, plan, zone, account, wispro_id",
        )
        .eq("id", decision.clientId)
        .maybeSingle<AgentClientSnapshot>();
      if (linkedClient) client = linkedClient;
    } else if (client?.id) {
      const { data: refreshedClient } = await supabase
        .from("clients")
        .select(
          "id, name, phone, whatsapp_id, wa_name, plan, zone, account, wispro_id",
        )
        .eq("id", client.id)
        .maybeSingle<AgentClientSnapshot>();
      if (refreshedClient) client = refreshedClient;
    }

    const { data: freshConversation, error: freshError } = await supabase
      .from("conversations")
      .select("id, human_mode, customer_phone, client_id, status")
      .eq("id", conversation.id)
      .maybeSingle<ConversationRow>();

    if (freshError) throw freshError;
    if (!freshConversation || Boolean(freshConversation.human_mode)) {
      const result = {
        ok: false,
        skipped: true,
        reason: "human_mode_active_before_send",
        runId: decision.runId,
      } as const;
      logGeminiNoReply("skipped", {
        ...baseContext,
        ...result,
        decisionAction: decision.action,
      });
      return result;
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
        if (!to) {
          logGeminiNoReply("failed", {
            ...baseContext,
            reason: "handoff_missing_recipient_phone",
            action: "handoff",
            runId: decision.runId,
          });
        } else {
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
                  run_id: decision.runId,
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
              ...baseContext,
              messageId: saved?.id ?? null,
              reason: decision.reason || null,
              runId: decision.runId,
              willReplyToClient: true,
            });

            return {
              ok: true,
              reason: "handoff",
              action: "handoff",
              messageId: saved?.id ?? null,
              runId: decision.runId,
            };
          } catch (error) {
            logGeminiNoReply("failed", {
              ...baseContext,
              reason: "handoff_whatsapp_send_failed",
              action: "handoff",
              runId: decision.runId,
              error: error instanceof Error ? error.message : "unknown_error",
            });
          }
        }
      } else {
        logGeminiNoReply("failed", {
          ...baseContext,
          reason: "handoff_empty_message",
          action: "handoff",
          runId: decision.runId,
        });
      }

      return {
        ok: true,
        reason: decision.reason || "handoff",
        action: "handoff",
        runId: decision.runId,
      };
    }

    const replyText = decision.message.trim();
    if (!replyText) {
      const result = {
        ok: false,
        skipped: true,
        reason: "empty_model_reply",
        runId: decision.runId,
      } as const;
      logGeminiNoReply("failed", { ...baseContext, ...result });
      return result;
    }

    const to = resolveRecipient(freshConversation, client);
    if (!to) {
      const result = {
        ok: false,
        skipped: true,
        reason: "missing_recipient_phone",
        runId: decision.runId,
      } as const;
      logGeminiNoReply("failed", {
        ...baseContext,
        ...result,
        customerPhone: freshConversation.customer_phone,
        clientPhone: client?.phone ?? null,
        clientWhatsappId: client?.whatsapp_id ?? null,
      });
      return result;
    }

    let waMessageId: string | null;
    try {
      waMessageId = await sendWhatsAppText(to, replyText);
    } catch (sendError) {
      logGeminiNoReply("failed", {
        ...baseContext,
        reason: "whatsapp_send_failed",
        to,
        runId: decision.runId,
        error: sendError instanceof Error ? sendError.message : "unknown_error",
        replyPreview: replyText.slice(0, 120),
      });
      throw sendError;
    }

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
          run_id: decision.runId,
          trigger_message_id: input.triggerMessageId ?? null,
        },
      })
      .select("id")
      .single();

    if (saveError) {
      logGeminiNoReply("failed", {
        ...baseContext,
        reason: "message_persist_failed",
        error: saveError.message,
        waMessageId,
        runId: decision.runId,
      });
      throw saveError;
    }

    await supabase
      .from("conversations")
      .update({
        preview: replyText,
        updated_at: now,
        last_message_at: now,
      })
      .eq("id", conversation.id);

    console.log(`${LOG_PREFIX} reply_sent`, {
      ...baseContext,
      messageId: savedMessage?.id ?? null,
      to,
      runId: decision.runId,
      willReplyToClient: true,
    });

    return {
      ok: true,
      reason: "reply_sent",
      action: "reply",
      messageId: savedMessage?.id ?? null,
      runId: decision.runId,
    };
  } catch (error) {
    logGeminiNoReply("failed", {
      ...baseContext,
      reason: "unexpected_error",
      error: error instanceof Error ? error.message : "unknown_error",
      name: error instanceof Error ? error.name : typeof error,
    });
    throw error;
  }
};
