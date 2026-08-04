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
import { ensureConversationLabel } from "@/app/api/crm/_lib/conversation-labels";
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
  shouldHandoff?: boolean;
  handoffMessage?: string;
  handoffReason?: string;
};

type PendingReceipt = {
  amount: string;
  transaction_code: string;
  bank: string;
  comment?: string | null;
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
        "Hay varios matches de Wispro. Confirma con el usuario y pasa wispro_id.",
    };
  }

  return {
    ok: false,
    error:
      "Falta lookup Wispro. Si el cliente aún no dio cédula, PÍDELA (no hagas handoff). Cuando la tenga, llama lookup_wispro_by_cedula y luego submit_payment_receipt.",
  };
};

const findReceiptMessage = async (ctx: AgentRunContext) => {
  if (ctx.triggerMessageId) {
    const { data } = await ctx.supabase
      .from("messages")
      .select("id, metadata, media_type")
      .eq("id", ctx.triggerMessageId)
      .maybeSingle();
    if (data) return data;
  }

  const { data: latestImage } = await ctx.supabase
    .from("messages")
    .select("id, metadata, media_type")
    .eq("conversation_id", ctx.conversationId)
    .eq("type", "in")
    .eq("media_type", "image")
    .order("created_at", { ascending: false })
    .limit(1)
    .maybeSingle();

  return latestImage;
};

const readPendingReceipt = (
  metadata: Record<string, unknown>,
): PendingReceipt | null => {
  const pending = metadata.pending_receipt;
  if (!pending || typeof pending !== "object") return null;
  const record = pending as Record<string, unknown>;
  const amount = String(record.amount || "").trim();
  const transactionCode = String(record.transaction_code || "").trim();
  const bank = String(record.bank || "").trim();
  if (!amount || !transactionCode || !bank) return null;
  return {
    amount,
    transaction_code: transactionCode,
    bank,
    comment:
      typeof record.comment === "string" ? record.comment : null,
  };
};

const markHandoff = (
  ctx: AgentRunContext,
  reason: string,
  message: string,
) => {
  ctx.escalated = true;
  ctx.escalateReason = reason;
  ctx.escalateMessage = message;
};

const applyPaymentVerificationLabel = async (ctx: AgentRunContext) => {
  const result = await ensureConversationLabel(
    ctx.supabase,
    ctx.conversationId,
    "verificar_pago",
  );
  return result;
};

const looksLikeSupportReason = (reason: string) => {
  const normalized = reason
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLowerCase();
  return (
    normalized.includes("soporte") ||
    normalized.includes("tecnico") ||
    normalized.includes("falla") ||
    normalized.includes("lentitud") ||
    normalized.includes("intermiten") ||
    normalized.includes("sin servicio") ||
    normalized.includes("clave") ||
    normalized.includes("password") ||
    normalized.includes("wifi") ||
    normalized.includes("router") ||
    normalized.includes("luz roja")
  );
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
              ? "Un solo match. Si hay comprobante pendiente, llama submit_payment_receipt."
              : "Varios matches. Confirma nombre/zona antes del pago.",
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
        hint: "Pide reintentar la cédula o, si insiste, escalate_to_human.",
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
        hint: "Cliente vinculado. Puedes continuar con submit_payment_receipt si hay comprobante.",
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
        hint: "Pide monto, referencia y banco si no son legibles. No hagas handoff todavía.",
      },
    };
  }

  const receiptMessage = await findReceiptMessage(ctx);
  const existingMetadata =
    receiptMessage?.metadata && typeof receiptMessage.metadata === "object"
      ? ({ ...(receiptMessage.metadata as Record<string, unknown>) } as Record<
          string,
          unknown
        >)
      : {};

  const pending = readPendingReceipt(existingMetadata);
  const amount = parsed.data.amount ?? pending?.amount ?? null;
  const transactionCode =
    parsed.data.transaction_code ?? pending?.transaction_code ?? null;
  const bank = (parsed.data.bank || pending?.bank || "").trim() || null;
  const comment = parsed.data.comment ?? pending?.comment ?? null;

  if (!amount || !transactionCode || !bank) {
    return {
      name: SUBMIT_PAYMENT_RECEIPT_TOOL,
      ok: false,
      response: {
        ok: false,
        error: "Faltan amount, transaction_code o bank",
        hint: "Extrae los datos del comprobante o pídelos. No hagas handoff.",
      },
    };
  }

  // Persist pending extraction so a later turn (after cedula) can reuse it.
  if (receiptMessage?.id) {
    const nextPending: PendingReceipt = {
      amount,
      transaction_code: transactionCode,
      bank,
      comment,
    };
    const { error: pendingError } = await ctx.supabase
      .from("messages")
      .update({
        metadata: {
          ...existingMetadata,
          pending_receipt: nextPending,
          pending_receipt_at: new Date().toISOString(),
        },
      })
      .eq("id", receiptMessage.id);

    if (pendingError) {
      console.warn("[AI_PAYMENT] pending_receipt_save_failed", {
        messageId: receiptMessage.id,
        error: pendingError.message,
      });
    } else {
      existingMetadata.pending_receipt = nextPending;
    }
  }

  const matchResult = resolvePaymentMatch(ctx, parsed.data.wispro_id);
  if (!matchResult.ok) {
    return {
      name: SUBMIT_PAYMENT_RECEIPT_TOOL,
      ok: false,
      response: {
        ok: false,
        error: matchResult.error,
        pending_receipt_saved: Boolean(receiptMessage?.id),
        needs_cedula: ctx.lastLookupByWisproId.size === 0,
        hint:
          ctx.lastLookupByWisproId.size === 0
            ? "Datos del comprobante guardados. Pide la cédula del abonado y luego lookup + submit. NO escalate."
            : matchResult.error,
      },
    };
  }

  const phoneId = resolvePhoneId(ctx);
  if (!phoneId) {
    const message =
      "No pudimos identificar tu número de WhatsApp. Un asesor te ayudará en breve.";
    const label = await applyPaymentVerificationLabel(ctx);
    markHandoff(ctx, "payment_missing_phone", message);
    return {
      name: SUBMIT_PAYMENT_RECEIPT_TOOL,
      ok: false,
      response: {
        ok: false,
        error: "No hay phone_id WhatsApp para este chat",
        should_handoff: true,
        label_applied: label.applied,
        label_id: label.labelId,
      },
      stopAgent: true,
      shouldHandoff: true,
      handoffMessage: message,
      handoffReason: "payment_missing_phone",
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
        error: "Falta cédula",
        hint: "Pide la cédula y haz lookup_wispro_by_cedula. No hagas handoff.",
        needs_cedula: true,
      },
    };
  }

  if (existingMetadata.payment_submitted === true) {
    const message =
      "Tu comprobante ya fue registrado. Un asesor lo verificará en breve.";
    const label = await applyPaymentVerificationLabel(ctx);
    markHandoff(ctx, "payment_already_submitted", message);
    return {
      name: SUBMIT_PAYMENT_RECEIPT_TOOL,
      ok: true,
      response: {
        ok: true,
        alreadyProcessed: true,
        message_id: receiptMessage?.id ?? null,
        should_handoff: true,
        label_applied: label.applied,
        label_id: label.labelId,
        hint: message,
      },
      stopAgent: true,
      shouldHandoff: true,
      handoffMessage: message,
      handoffReason: "payment_already_submitted",
    };
  }

  const payload = {
    client_id: match.customer.id,
    amount,
    transaction_code: transactionCode,
    bank,
    name: match.customer.name,
    cedula,
    phone_id: phoneId,
  };

  try {
    const result = await submitInnoverPayment(payload);

    if (receiptMessage?.id) {
      const { error: updateError } = await ctx.supabase
        .from("messages")
        .update({
          metadata: {
            ...existingMetadata,
            payment_submitted: true,
            payment_submitted_at: new Date().toISOString(),
            payment_submitted_run_id: ctx.runId,
            payment_submitted_payload: payload,
            payment_api_status: result.status,
            payment_comment: comment,
            pending_receipt: null,
          },
        })
        .eq("id", receiptMessage.id);

      if (updateError) {
        console.warn("[AI_PAYMENT] metadata_update_failed", {
          messageId: receiptMessage.id,
          error: updateError.message,
        });
      }
    }

    const message =
      "Registramos tu comprobante de pago. Un asesor lo verificará en breve.";
    const label = await applyPaymentVerificationLabel(ctx);
    markHandoff(ctx, "payment_submitted", message);

    return {
      name: SUBMIT_PAYMENT_RECEIPT_TOOL,
      ok: true,
      response: {
        ok: true,
        alreadyProcessed: false,
        submitted: true,
        should_handoff: true,
        message_id: receiptMessage?.id ?? null,
        client_id: payload.client_id,
        amount: payload.amount,
        transaction_code: payload.transaction_code,
        bank: payload.bank,
        name: payload.name,
        cedula: payload.cedula,
        label_applied: label.applied,
        label_id: label.labelId,
        hint: message,
      },
      stopAgent: true,
      shouldHandoff: true,
      handoffMessage: message,
      handoffReason: "payment_submitted",
    };
  } catch (error) {
    const apiMessage =
      error instanceof InnoverPaymentsError
        ? error.message
        : error instanceof Error
          ? error.message
          : "No se pudo registrar el pago";

    if (receiptMessage?.id) {
      await ctx.supabase
        .from("messages")
        .update({
          metadata: {
            ...existingMetadata,
            payment_submit_failed: true,
            payment_submit_failed_at: new Date().toISOString(),
            payment_submit_error: apiMessage,
            payment_api_status:
              error instanceof InnoverPaymentsError ? error.status : null,
          },
        })
        .eq("id", receiptMessage.id);
    }

    const message =
      "No pudimos registrar tu pago automáticamente. Un asesor te atenderá en breve.";
    const label = await applyPaymentVerificationLabel(ctx);
    markHandoff(ctx, "payment_api_error", message);

    return {
      name: SUBMIT_PAYMENT_RECEIPT_TOOL,
      ok: false,
      response: {
        ok: false,
        error: apiMessage,
        should_handoff: true,
        api_status:
          error instanceof InnoverPaymentsError ? error.status : null,
        label_applied: label.applied,
        label_id: label.labelId,
        hint: message,
      },
      stopAgent: true,
      shouldHandoff: true,
      handoffMessage: message,
      handoffReason: "payment_api_error",
    };
  }
};

const handleEscalate = async (
  ctx: AgentRunContext,
  rawArgs: unknown,
): Promise<ToolHandlerResult> => {
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

  const message =
    parsed.data.message?.trim() ||
    "Un asesor de nuestro equipo continuará contigo en breve.";

  const isSupport =
    parsed.data.category === "support" ||
    looksLikeSupportReason(parsed.data.reason);

  let labelApplied = false;
  let labelId: number | null = null;
  if (isSupport) {
    const label = await ensureConversationLabel(
      ctx.supabase,
      ctx.conversationId,
      "soporte",
    );
    labelApplied = label.applied;
    labelId = label.labelId;
  }

  const handoffReason = isSupport
    ? `support:${parsed.data.reason}`
    : parsed.data.reason;

  markHandoff(ctx, handoffReason, message);

  return {
    name: ESCALATE_HUMAN_TOOL,
    ok: true,
    response: {
      ok: true,
      escalated: true,
      reason: parsed.data.reason,
      category: isSupport ? "support" : "general",
      label_applied: labelApplied,
      label_id: labelId,
      message_queued: message,
    },
    stopAgent: true,
    shouldHandoff: true,
    handoffMessage: message,
    handoffReason,
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
      result = await handleEscalate(ctx, rawArgs);
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
    shouldHandoff: result.shouldHandoff ?? false,
    durationMs: Date.now() - started,
  });

  return result;
};
