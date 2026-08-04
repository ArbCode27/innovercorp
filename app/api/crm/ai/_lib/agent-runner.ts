import type { SupabaseClient } from "@supabase/supabase-js";
import { DEFAULT_AI_SYSTEM_PROMPT } from "@/app/crm/_lib/ai-default-prompt";
import {
  buildAgentContents,
  GEMINI_MEDIA_CONTRACT_PROMPT,
  type AgentHistoryMessage,
} from "./context-builder";
import type { GeminiContent, GeminiContentPart } from "./gemini";
import {
  generateGeminiWithRetry,
  isRetryableGeminiError,
  stripInlineMediaFromContents,
} from "./gemini-retry";
import { GEMINI_TOOLS_CONTRACT_PROMPT } from "./gemini-tools";
import {
  executeAgentTool,
  type AgentRunContext,
} from "./tool-handlers";

const LOG_PREFIX = "[AI_AGENT]";
const MAX_TOOL_STEPS = 6;

export type AgentClientSnapshot = {
  id: number;
  name: string | null;
  phone: string | null;
  whatsapp_id: string | null;
  wa_name: string | null;
  plan: string | null;
  zone: string | null;
  account: string | null;
  wispro_id: string | null;
};

export type AgentDecision = {
  action: "reply" | "handoff";
  message: string;
  reason?: string;
  runId: string;
  clientId: number | null;
};

const buildIdentityBlock = (input: {
  conversationId: number;
  customerPhone: string | null;
  client: AgentClientSnapshot | null;
}) => {
  const linked = Boolean(input.client?.wispro_id);

  return [
    "Identidad de ESTE chat (inyectada por el sistema; no la inventes):",
    `- conversation_id: ${input.conversationId}`,
    `- telefono_whatsapp: ${input.customerPhone || input.client?.whatsapp_id || input.client?.phone || "N/D"}`,
    `- cliente_crm_id: ${input.client?.id ?? "N/D"}`,
    `- nombre_crm: ${input.client?.name || input.client?.wa_name || "Desconocido"}`,
    `- wa_name: ${input.client?.wa_name || "N/D"}`,
    `- plan: ${input.client?.plan || "N/D"}`,
    `- zona: ${input.client?.zone || "N/D"}`,
    `- estado_cuenta_crm: ${input.client?.account || "N/D"}`,
    `- wispro_id: ${input.client?.wispro_id || "N/D"}`,
    `- vinculado_wispro: ${linked ? "sí" : "no"}`,
  ].join("\n");
};

const createAgentContext = (input: {
  supabase: SupabaseClient;
  conversationId: number;
  customerPhone: string | null;
  client: AgentClientSnapshot | null;
  runId: string;
  triggerMessageId?: number | null;
}): AgentRunContext => ({
  supabase: input.supabase,
  conversationId: input.conversationId,
  clientId: input.client?.id ?? null,
  customerPhone: input.customerPhone,
  whatsappId: input.client?.whatsapp_id ?? null,
  waName: input.client?.wa_name ?? null,
  runId: input.runId,
  triggerMessageId: input.triggerMessageId ?? null,
  lastLookupByWisproId: new Map(),
  lastLookupCedula: null,
  escalated: false,
  escalateReason: null,
  escalateMessage: null,
});

const runAgentLoop = async (input: {
  systemPrompt: string;
  contents: GeminiContent[];
  model: string;
  ctx: AgentRunContext;
  timeoutsMs: number[];
  degraded: boolean;
}): Promise<AgentDecision> => {
  const workingContents: GeminiContent[] = input.contents.map((content) => ({
    role: content.role,
    parts: [...content.parts],
  }));

  const logContext = {
    conversationId: input.ctx.conversationId,
    runId: input.ctx.runId,
    degraded: input.degraded,
  };

  for (let step = 0; step < MAX_TOOL_STEPS; step += 1) {
    const generated = await generateGeminiWithRetry({
      systemPrompt: input.systemPrompt,
      contents: workingContents,
      model: input.model,
      enableTools: true,
      timeoutsMs: input.timeoutsMs,
      logContext: { ...logContext, step },
    });

    console.log(`${LOG_PREFIX} loop_step`, {
      ...logContext,
      step,
      functionCallCount: generated.functionCalls.length,
      hasText: Boolean(generated.text),
    });

    if (generated.functionCalls.length > 0) {
      if (generated.modelContent) {
        workingContents.push(generated.modelContent);
      } else {
        workingContents.push({
          role: "model",
          parts: generated.functionCalls.map((call) => ({
            functionCall: {
              name: call.name,
              args: call.args,
            },
          })),
        });
      }

      const responseParts: GeminiContentPart[] = [];
      let stopAgent = false;

      for (const call of generated.functionCalls) {
        const toolResult = await executeAgentTool(
          input.ctx,
          call.name,
          call.args,
        );
        responseParts.push({
          functionResponse: {
            name: toolResult.name,
            response: toolResult.response,
          },
        });

        if (toolResult.shouldHandoff) {
          input.ctx.escalated = true;
          if (toolResult.handoffReason) {
            input.ctx.escalateReason = toolResult.handoffReason;
          }
          if (toolResult.handoffMessage) {
            input.ctx.escalateMessage = toolResult.handoffMessage;
          }
        }

        if (toolResult.stopAgent || toolResult.shouldHandoff) {
          stopAgent = true;
        }
      }

      workingContents.push({
        role: "user",
        parts: responseParts,
      });

      if (stopAgent || input.ctx.escalated) {
        break;
      }

      continue;
    }

    const replyText = generated.text.trim();
    if (!replyText) {
      throw new Error("empty_model_reply");
    }

    console.log(`${LOG_PREFIX} final_text`, {
      ...logContext,
      preview: replyText.slice(0, 160),
    });

    return {
      action: "reply",
      message: replyText,
      runId: input.ctx.runId,
      clientId: input.ctx.clientId,
    };
  }

  if (input.ctx.escalated) {
    return {
      action: "handoff",
      message:
        input.ctx.escalateMessage ||
        "Un asesor de nuestro equipo continuará contigo en breve.",
      reason: input.ctx.escalateReason || "escalate_to_human",
      runId: input.ctx.runId,
      clientId: input.ctx.clientId,
    };
  }

  const fallback = await generateGeminiWithRetry({
    systemPrompt: `${input.systemPrompt}\n\nNo uses más tools. Responde ahora al cliente en texto claro.`,
    contents: workingContents,
    model: input.model,
    enableTools: false,
    timeoutsMs: input.timeoutsMs,
    logContext: { ...logContext, step: "text_fallback" },
  });

  const fallbackText = fallback.text.trim();
  if (!fallbackText) {
    throw new Error("empty_model_reply_after_tools");
  }

  return {
    action: "reply",
    message: fallbackText,
    reason: "tool_loop_exhausted",
    runId: input.ctx.runId,
    clientId: input.ctx.clientId,
  };
};

export const runGeminiAgent = async (input: {
  supabase: SupabaseClient;
  conversationId: number;
  customerPhone: string | null;
  client: AgentClientSnapshot | null;
  messages: AgentHistoryMessage[];
  triggerMessageId?: number | null;
  businessPrompt: string | null | undefined;
  model: string;
}): Promise<AgentDecision> => {
  const runId = crypto.randomUUID();
  const { contents, attachedMediaIds } = await buildAgentContents({
    messages: input.messages,
    triggerMessageId: input.triggerMessageId,
  });

  if (!contents.length) {
    throw new Error("empty_history");
  }

  const systemPrompt = [
    input.businessPrompt?.trim() || DEFAULT_AI_SYSTEM_PROMPT,
    "",
    GEMINI_TOOLS_CONTRACT_PROMPT,
    "",
    GEMINI_MEDIA_CONTRACT_PROMPT,
    "",
    buildIdentityBlock({
      conversationId: input.conversationId,
      customerPhone: input.customerPhone,
      client: input.client,
    }),
  ].join("\n");

  const hasInlineMedia = attachedMediaIds.length > 0;
  // Primary: longer budget for multimodal + tools. Retries bump further.
  const primaryTimeouts = hasInlineMedia ? [60000, 75000] : [35000, 50000];
  const degradedTimeouts = [45000, 60000];

  console.log(`${LOG_PREFIX} started`, {
    conversationId: input.conversationId,
    runId,
    model: input.model,
    contentsCount: contents.length,
    attachedMediaIds,
    linkedWispro: Boolean(input.client?.wispro_id),
    primaryTimeouts,
  });

  const ctx = createAgentContext({
    supabase: input.supabase,
    conversationId: input.conversationId,
    customerPhone: input.customerPhone,
    client: input.client,
    runId,
    triggerMessageId: input.triggerMessageId,
  });

  try {
    return await runAgentLoop({
      systemPrompt,
      contents,
      model: input.model,
      ctx,
      timeoutsMs: primaryTimeouts,
      degraded: false,
    });
  } catch (error) {
    if (!hasInlineMedia || !isRetryableGeminiError(error)) {
      throw error;
    }

    console.warn(`${LOG_PREFIX} degraded_retry`, {
      conversationId: input.conversationId,
      runId,
      reason: error instanceof Error ? error.message : "unknown_error",
    });

    const degradedCtx = createAgentContext({
      supabase: input.supabase,
      conversationId: input.conversationId,
      customerPhone: input.customerPhone,
      client: input.client,
      runId,
      triggerMessageId: input.triggerMessageId,
    });

    const decision = await runAgentLoop({
      systemPrompt: `${systemPrompt}\n\nNota: el media inline se omitió por timeout. Usa el historial de texto ([Imagen]) y tools.`,
      contents: stripInlineMediaFromContents(contents),
      model: input.model,
      ctx: degradedCtx,
      timeoutsMs: degradedTimeouts,
      degraded: true,
    });

    return {
      ...decision,
      reason: decision.reason
        ? `${decision.reason}|degraded_no_inline_media`
        : "degraded_no_inline_media",
    };
  }
};
