import type { SupabaseClient } from "@supabase/supabase-js";
import {
  resolveEffectiveBotEngine,
  shouldNotifyMake,
  type BotEngine,
} from "@/app/api/crm/_lib/bot-engine";
import { getCrmSettings } from "@/app/api/crm/_lib/crm-settings";

const LOG_PREFIX = "[WHATSAPP_MAKE_GATE]";

export type BotRouteContext = {
  engine: BotEngine;
  allowMake: boolean;
  humanMode: boolean;
  conversationBotEngine: string | null;
  globalBotEngine: BotEngine;
};

export const resolveBotRouteContext = async (
  supabase: SupabaseClient,
  input: {
    humanMode?: boolean | null;
    conversationBotEngine?: string | null;
  },
): Promise<BotRouteContext> => {
  const settings = await getCrmSettings(supabase);
  const humanMode = Boolean(input.humanMode);
  const conversationBotEngine = input.conversationBotEngine ?? null;
  const engine = resolveEffectiveBotEngine({
    conversationBotEngine,
    globalBotEngine: settings.bot_engine,
  });

  return {
    engine,
    allowMake: shouldNotifyMake({
      humanMode,
      conversationBotEngine,
      globalBotEngine: settings.bot_engine,
    }),
    humanMode,
    conversationBotEngine,
    globalBotEngine: settings.bot_engine,
  };
};

export const findConversationEngineByWaMessageId = async (
  supabase: SupabaseClient,
  waMessageId: string,
): Promise<{
  conversationId: number | null;
  humanMode: boolean | null;
  botEngine: string | null;
} | null> => {
  const { data: message, error: messageError } = await supabase
    .from("messages")
    .select("conversation_id")
    .eq("wa_message_id", waMessageId)
    .maybeSingle();

  if (messageError) {
    console.error(`${LOG_PREFIX} message_lookup_failed`, {
      waMessageId,
      error: messageError.message,
    });
    return null;
  }

  if (!message?.conversation_id) return null;

  const { data: conversation, error: conversationError } = await supabase
    .from("conversations")
    .select("id, human_mode, bot_engine")
    .eq("id", message.conversation_id)
    .maybeSingle();

  if (conversationError) {
    console.error(`${LOG_PREFIX} conversation_lookup_failed`, {
      conversationId: message.conversation_id,
      error: conversationError.message,
    });
    return null;
  }

  if (!conversation) return null;

  return {
    conversationId: Number(conversation.id) || null,
    humanMode:
      conversation.human_mode === null || conversation.human_mode === undefined
        ? null
        : Boolean(conversation.human_mode),
    botEngine:
      typeof conversation.bot_engine === "string"
        ? conversation.bot_engine
        : null,
  };
};

export const notifyMakeWebhook = async (
  url: string,
  payload: Record<string, unknown>,
  meta: { eventType: string; context?: Record<string, unknown> },
) => {
  const response = await fetch(url, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(payload),
  });

  if (!response.ok) {
    console.error(`${LOG_PREFIX} notify_failed`, {
      eventType: meta.eventType,
      status: response.status,
      ...meta.context,
    });
    return false;
  }

  console.log(`${LOG_PREFIX} notify_sent`, {
    eventType: meta.eventType,
    ...meta.context,
  });
  return true;
};
