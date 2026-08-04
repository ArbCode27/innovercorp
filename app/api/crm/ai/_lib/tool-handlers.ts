import type { SupabaseClient } from "@supabase/supabase-js";
import { associateWisproClient } from "@/app/crm/_lib/wispro-associate";
import type { WisproSearchResult } from "@/app/crm/_lib/types";
import {
  searchWisproByCedula,
  WisproApiError,
} from "@/app/api/crm/_lib/wispro-api";
import {
  ESCALATE_HUMAN_TOOL,
  LINK_WISPRO_TOOL,
  LOOKUP_WISPRO_TOOL,
  escalateHumanArgsSchema,
  linkWisproArgsSchema,
  lookupWisproArgsSchema,
} from "./gemini-tools";
import { auditToolInvocation } from "./tool-audit";

export type AgentRunContext = {
  supabase: SupabaseClient;
  conversationId: number;
  clientId: number | null;
  customerPhone: string | null;
  whatsappId: string | null;
  waName: string | null;
  runId: string;
  /** Cache of last Wispro matches by wispro_id (for safe link). */
  lastLookupByWisproId: Map<string, WisproSearchResult>;
  escalated: boolean;
  escalateReason: string | null;
  escalateMessage: string | null;
};

export type ToolHandlerResult = {
  name: string;
  ok: boolean;
  response: Record<string, unknown>;
  stopAgent?: boolean;
};

const summarizeMatch = (result: WisproSearchResult) => ({
  wispro_id: result.customer.id,
  name: result.customer.name,
  cedula: result.customer.national_identification_number,
  zone: result.customer.zone_name ?? null,
  city: result.customer.city ?? null,
  phone_mobile: result.customer.phone_mobile ?? null,
  account_status: result.invoicing.accountStatus,
  debt: result.invoicing.debt,
  has_debt: result.invoicing.hasDebt,
});

const handleLookup = async (
  ctx: AgentRunContext,
  rawArgs: unknown,
): Promise<ToolHandlerResult> => {
  const parsed = lookupWisproArgsSchema.safeParse(rawArgs);
  if (!parsed.success) {
    return {
      name: LOOKUP_WISPRO_TOOL,
      ok: false,
      response: {
        ok: false,
        error: parsed.error.issues[0]?.message || "Cédula inválida",
      },
    };
  }

  try {
    const results = await searchWisproByCedula(parsed.data.cedula);
    ctx.lastLookupByWisproId.clear();
    for (const result of results) {
      ctx.lastLookupByWisproId.set(result.customer.id, result);
    }

    return {
      name: LOOKUP_WISPRO_TOOL,
      ok: true,
      response: {
        ok: true,
        cedula: parsed.data.cedula,
        count: results.length,
        matches: results.map(summarizeMatch),
        hint:
          results.length === 0
            ? "No se encontró abonado. Pide verificar la cédula."
            : results.length === 1
              ? "Un solo match. Puedes llamar link_wispro_client con ese wispro_id."
              : "Varios matches. Confirma nombre/zona con el usuario antes de link.",
      },
    };
  } catch (error) {
    const message =
      error instanceof WisproApiError
        ? error.message
        : error instanceof Error
          ? error.message
          : "Error al consultar Wispro";

    return {
      name: LOOKUP_WISPRO_TOOL,
      ok: false,
      response: {
        ok: false,
        error: message,
        hint: "Informa al cliente que no pudiste consultar ahora e intenta de nuevo o escala a humano.",
      },
    };
  }
};

const handleLink = async (
  ctx: AgentRunContext,
  rawArgs: unknown,
): Promise<ToolHandlerResult> => {
  const parsed = linkWisproArgsSchema.safeParse(rawArgs);
  if (!parsed.success) {
    return {
      name: LINK_WISPRO_TOOL,
      ok: false,
      response: {
        ok: false,
        error: parsed.error.issues[0]?.message || "wispro_id inválido",
      },
    };
  }

  const match = ctx.lastLookupByWisproId.get(parsed.data.wispro_id);
  if (!match) {
    return {
      name: LINK_WISPRO_TOOL,
      ok: false,
      response: {
        ok: false,
        error:
          "No hay un lookup reciente con ese wispro_id. Llama primero lookup_wispro_by_cedula.",
      },
    };
  }

  try {
    const { data: conversation, error: conversationError } = await ctx.supabase
      .from("conversations")
      .select("id, client_id, human_mode, customer_phone, status")
      .eq("id", ctx.conversationId)
      .maybeSingle();

    if (conversationError) throw conversationError;
    if (!conversation) {
      return {
        name: LINK_WISPRO_TOOL,
        ok: false,
        response: { ok: false, error: "Conversación no encontrada" },
      };
    }

    if (Boolean(conversation.human_mode)) {
      return {
        name: LINK_WISPRO_TOOL,
        ok: false,
        response: {
          ok: false,
          error: "La conversación está en modo humano; no se puede vincular.",
        },
        stopAgent: true,
      };
    }

    if (conversation.status === "resuelto") {
      return {
        name: LINK_WISPRO_TOOL,
        ok: false,
        response: { ok: false, error: "La conversación ya está resuelta" },
        stopAgent: true,
      };
    }

    const client = await associateWisproClient(ctx.supabase, {
      conversationId: ctx.conversationId,
      customer: match.customer,
      invoicing: match.invoicing,
      existingClientId: conversation.client_id ?? ctx.clientId,
      conversationPhone:
        conversation.customer_phone ?? ctx.customerPhone ?? ctx.whatsappId,
      whatsappId: ctx.whatsappId,
      waName: ctx.waName,
    });

    ctx.clientId = client.id;

    return {
      name: LINK_WISPRO_TOOL,
      ok: true,
      response: {
        ok: true,
        linked: true,
        client_id: client.id,
        wispro_id: client.wispro_id ?? match.customer.id,
        name: client.name,
        zone: client.zone,
        account: client.account,
        debt: match.invoicing.debt,
        has_debt: match.invoicing.hasDebt,
        account_status: match.invoicing.accountStatus,
        hint: "Cliente vinculado a ESTE chat. Usa estos datos para responder; no inventes saldos.",
      },
    };
  } catch (error) {
    return {
      name: LINK_WISPRO_TOOL,
      ok: false,
      response: {
        ok: false,
        error:
          error instanceof Error ? error.message : "No se pudo vincular Wispro",
      },
    };
  }
};

const handleEscalate = (
  ctx: AgentRunContext,
  rawArgs: unknown,
): ToolHandlerResult => {
  const parsed = escalateHumanArgsSchema.safeParse(rawArgs);
  if (!parsed.success) {
    return {
      name: ESCALATE_HUMAN_TOOL,
      ok: false,
      response: {
        ok: false,
        error: parsed.error.issues[0]?.message || "Argumentos inválidos",
      },
    };
  }

  ctx.escalated = true;
  ctx.escalateReason = parsed.data.reason;
  ctx.escalateMessage =
    parsed.data.message?.trim() ||
    "Un asesor de nuestro equipo continuará contigo en breve.";

  return {
    name: ESCALATE_HUMAN_TOOL,
    ok: true,
    response: {
      ok: true,
      escalated: true,
      reason: ctx.escalateReason,
      message_queued: ctx.escalateMessage,
    },
    stopAgent: true,
  };
};

export const executeAgentTool = async (
  ctx: AgentRunContext,
  toolName: string,
  rawArgs: unknown,
): Promise<ToolHandlerResult> => {
  const started = Date.now();
  let result: ToolHandlerResult;

  switch (toolName) {
    case LOOKUP_WISPRO_TOOL:
      result = await handleLookup(ctx, rawArgs);
      break;
    case LINK_WISPRO_TOOL:
      result = await handleLink(ctx, rawArgs);
      break;
    case ESCALATE_HUMAN_TOOL:
      result = handleEscalate(ctx, rawArgs);
      break;
    default:
      result = {
        name: toolName,
        ok: false,
        response: {
          ok: false,
          error: `Tool no soportada: ${toolName}`,
        },
      };
  }

  await auditToolInvocation(ctx.supabase, {
    conversationId: ctx.conversationId,
    runId: ctx.runId,
    toolName: result.name,
    args: rawArgs,
    result: result.response,
    ok: result.ok,
    durationMs: Date.now() - started,
    error: result.ok ? null : String(result.response.error || "tool_failed"),
  });

  console.log(`[AI_TOOL] ${result.ok ? "ok" : "fail"}`, {
    conversationId: ctx.conversationId,
    runId: ctx.runId,
    toolName: result.name,
    ok: result.ok,
    durationMs: Date.now() - started,
  });

  return result;
};
