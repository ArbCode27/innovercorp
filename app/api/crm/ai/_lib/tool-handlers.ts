import type { SupabaseClient } from "@supabase/supabase-js";
import { associateWisproClient } from "@/app/crm/_lib/wispro-associate";
import type { WisproSearchResult } from "@/app/crm/_lib/types";
import {
  searchWisproByCedula,
  WisproApiError,
} from "@/app/api/crm/_lib/wispro-api";
import {
  InnoverPaymentsError,
  submitInnoverPayment,
} from "@/app/api/crm/_lib/innover-payments";
import {
  ESCALATE_HUMAN_TOOL,
  LINK_WISPRO_TOOL,
  LOOKUP_WISPRO_TOOL,
  SUBMIT_PAYMENT_RECEIPT_TOOL,
  escalateHumanArgsSchema,
  linkWisproArgsSchema,
  lookupWisproArgsSchema,
  submitPaymentReceiptArgsSchema,
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
  triggerMessageId: number | null;
  /** Cache of last Wispro matches by wispro_id (for link/payment). */
  lastLookupByWisproId: Map<string, WisproSearchResult>;
  lastLookupCedula: string | null;
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

const normalizePhone = (value: string | null | undefined) =>
  String(value || "").replace(/\D/g, "");

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

const resolvePhoneId = (ctx: AgentRunContext) => {
  const candidates = [ctx.customerPhone, ctx.whatsappId]
    .map((value) => normalizePhone(value))
    .filter((value) => value.length >= 8 && value.length <= 15);
  return candidates[0] || null;
};

const resolvePaymentMatch = (
  ctx: AgentRunContext,
  wisproId?: string | null,
): { ok: true; match: WisproSearchResult } | { ok: false; error: string } => {
  if (wisproId) {
    const match = ctx.lastLookupByWisproId.get(wisproId);
    if (!match) {
      return {
        ok: false,
        error:
          "wispro_id no está en el lookup reciente. Llama lookup_wispro_by_cedula otra vez.",
      };
    }
    return { ok: true, match };
  }

  const matches = [...ctx.lastLookupByWisproId.values()];
  if (matches.length === 1) {
    return { ok: true, match: matches[0] };
  }

  if (matches.length > 1) {
    return {
      ok: false,
      error:
        "Hay varios matches de Wispro. Confirma con el usuario y pasa wispro_id a submit_payment_receipt.",
    };
  }

  return {
    ok: false,
    error:
      "No hay lookup Wispro reciente. Llama primero lookup_wispro_by_cedula con la cédula del cliente (no hace falta link).",
  };
};

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
    ctx.lastLookupCedula = parsed.data.cedula;
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
              ? "Un solo match. Puedes link_wispro_client o submit_payment_receipt sin link."
              : "Varios matches. Confirma nombre/zona antes de link o pago.",
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

const handleSubmitPaymentReceipt = async (
  ctx: AgentRunContext,
  rawArgs: unknown,
): Promise<ToolHandlerResult> => {
  const parsed = submitPaymentReceiptArgsSchema.safeParse(rawArgs);
  if (!parsed.success) {
    return {
      name: SUBMIT_PAYMENT_RECEIPT_TOOL,
      ok: false,
      response: {
        ok: false,
        error: parsed.error.issues[0]?.message || "Datos del comprobante inválidos",
        hint: "Pide al cliente monto, referencia y banco si no son legibles.",
      },
    };
  }

  const matchResult = resolvePaymentMatch(ctx, parsed.data.wispro_id);
  if (!matchResult.ok) {
    return {
      name: SUBMIT_PAYMENT_RECEIPT_TOOL,
      ok: false,
      response: {
        ok: false,
        error: matchResult.error,
      },
    };
  }

  const phoneId = resolvePhoneId(ctx);
  if (!phoneId) {
    return {
      name: SUBMIT_PAYMENT_RECEIPT_TOOL,
      ok: false,
      response: {
        ok: false,
        error: "No hay phone_id WhatsApp para este chat",
      },
    };
  }

  const match = matchResult.match;
  const cedula =
    parsed.data.cedula ||
    match.customer.national_identification_number ||
    ctx.lastLookupCedula;

  if (!cedula) {
    return {
      name: SUBMIT_PAYMENT_RECEIPT_TOOL,
      ok: false,
      response: {
        ok: false,
        error: "Falta cédula. Haz lookup_wispro_by_cedula primero.",
      },
    };
  }

  // Idempotency on the trigger / latest inbound image message.
  let targetMessageId = ctx.triggerMessageId;
  if (!targetMessageId) {
    const { data: latestImage } = await ctx.supabase
      .from("messages")
      .select("id, metadata, media_type")
      .eq("conversation_id", ctx.conversationId)
      .eq("type", "in")
      .eq("media_type", "image")
      .order("created_at", { ascending: false })
      .limit(1)
      .maybeSingle();
    targetMessageId = latestImage?.id ?? null;
  }

  let existingMetadata: Record<string, unknown> = {};
  if (targetMessageId) {
    const { data: messageRow } = await ctx.supabase
      .from("messages")
      .select("id, metadata")
      .eq("id", targetMessageId)
      .maybeSingle();

    existingMetadata =
      messageRow?.metadata && typeof messageRow.metadata === "object"
        ? (messageRow.metadata as Record<string, unknown>)
        : {};

    if (existingMetadata.payment_submitted === true) {
      return {
        name: SUBMIT_PAYMENT_RECEIPT_TOOL,
        ok: true,
        response: {
          ok: true,
          alreadyProcessed: true,
          message_id: targetMessageId,
          hint: "Este comprobante ya fue enviado al API de pagos. Informa al cliente que está en revisión.",
        },
      };
    }
  }

  const payload = {
    client_id: match.customer.id,
    amount: parsed.data.amount,
    transaction_code: parsed.data.transaction_code,
    bank: parsed.data.bank,
    name: match.customer.name,
    cedula,
    phone_id: phoneId,
  };

  try {
    const result = await submitInnoverPayment(payload);

    if (targetMessageId) {
      const nextMetadata = {
        ...existingMetadata,
        payment_submitted: true,
        payment_submitted_at: new Date().toISOString(),
        payment_submitted_run_id: ctx.runId,
        payment_submitted_payload: {
          client_id: payload.client_id,
          amount: payload.amount,
          transaction_code: payload.transaction_code,
          bank: payload.bank,
          cedula: payload.cedula,
          phone_id: payload.phone_id,
        },
        payment_api_status: result.status,
        payment_comment: parsed.data.comment ?? null,
      };

      const { error: updateError } = await ctx.supabase
        .from("messages")
        .update({ metadata: nextMetadata })
        .eq("id", targetMessageId);

      if (updateError) {
        console.warn("[AI_PAYMENT] metadata_update_failed", {
          messageId: targetMessageId,
          error: updateError.message,
        });
      }
    }

    return {
      name: SUBMIT_PAYMENT_RECEIPT_TOOL,
      ok: true,
      response: {
        ok: true,
        alreadyProcessed: false,
        submitted: true,
        message_id: targetMessageId,
        client_id: payload.client_id,
        amount: payload.amount,
        transaction_code: payload.transaction_code,
        bank: payload.bank,
        name: payload.name,
        cedula: payload.cedula,
        hint: "Pago registrado en Innover (en revisión). Confirma recepción al cliente; NO digas que está aprobado.",
      },
    };
  } catch (error) {
    const message =
      error instanceof InnoverPaymentsError
        ? error.message
        : error instanceof Error
          ? error.message
          : "No se pudo registrar el pago";

    return {
      name: SUBMIT_PAYMENT_RECEIPT_TOOL,
      ok: false,
      response: {
        ok: false,
        error: message,
        hint: "Informa el fallo y pide reintentar o usa escalate_to_human.",
        api_status:
          error instanceof InnoverPaymentsError ? error.status : null,
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
    case SUBMIT_PAYMENT_RECEIPT_TOOL:
      result = await handleSubmitPaymentReceipt(ctx, rawArgs);
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
