import type { SupabaseClient } from "@supabase/supabase-js";
import { associateWisproClient } from "@/app/crm/_lib/wispro-associate";
import type { WisproSearchResult } from "@/app/crm/_lib/types";
import {
  createPaymentPromiseForClient,
  DEFAULT_PAYMENT_PROMISE_HOURS,
  searchWisproByCedula,
  WisproApiError,
} from "@/app/api/crm/_lib/wispro-api";
import {
  InnoverPaymentsError,
  submitInnoverPayment,
} from "@/app/api/crm/_lib/innover-payments";
import { ensureConversationLabel } from "@/app/api/crm/_lib/conversation-labels";
import {
  DolarVzlaError,
  enrichDebtWithBcv,
  getBcvRate,
} from "@/app/api/crm/_lib/dolarvzla-rate";
import {
  ESCALATE_HUMAN_TOOL,
  GET_BCV_RATE_TOOL,
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
  replyMode?: "full" | "after_hours_payments" | "forced" | "skip";
  allowedToolNames?: string[] | null;
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

const summarizeMatch = async (result: WisproSearchResult) => {
  const debtUsd = Number(result.invoicing.debt) || 0;
  const fx = await enrichDebtWithBcv(debtUsd);

  return {
    wispro_id: result.customer.id,
    name: result.customer.name,
    cedula: result.customer.national_identification_number,
    zone: result.customer.zone_name ?? null,
    city: result.customer.city ?? null,
    phone_mobile: result.customer.phone_mobile ?? null,
    account_status: result.invoicing.accountStatus,
    service_suspended: Boolean(result.invoicing.serviceSuspended),
    contract_state: result.invoicing.contractState ?? null,
    debt: debtUsd,
    has_debt: result.invoicing.hasDebt,
    debt_usd: fx.debt_usd,
    debt_usd_formatted: fx.debt_usd_formatted,
    debt_bs: fx.debt_bs,
    debt_bs_formatted: fx.debt_bs_formatted,
    bcv_rate: fx.ok ? fx.bcv_rate : null,
    bcv_usd: fx.ok ? fx.bcv_usd : null,
    bcv_eur: fx.ok ? fx.bcv_eur : null,
    bcv_as_of: fx.ok ? fx.bcv_as_of : null,
    bcv_source: fx.ok ? fx.bcv_source : null,
    bcv_error: fx.ok ? null : fx.bcv_error,
    currency_hint: fx.ok
      ? "Usa debt_bs_formatted y debt_usd_formatted. No recalcules ni inventes tasa."
      : fx.hint,
  };
};

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

const handleGetBcvRate = async (): Promise<ToolHandlerResult> => {
  try {
    const rate = await getBcvRate();
    return {
      name: GET_BCV_RATE_TOOL,
      ok: true,
      response: {
        ok: true,
        bcv_rate: rate.rate,
        bcv_usd: rate.usd,
        bcv_eur: rate.eur,
        bcv_as_of: rate.asOf,
        bcv_source: rate.source,
        bcv_cached: rate.cached,
        bcv_change_percentage_usd: rate.changePercentageUsd,
        bcv_rate_display: `${rate.usd.toFixed(4).replace(".", ",")} Bs/$`,
        hint: "Usa bcv_rate (current.usd = tasa BCV del día). No inventes otra tasa.",
      },
    };
  } catch (error) {
    const message =
      error instanceof DolarVzlaError
        ? error.message
        : error instanceof Error
          ? error.message
          : "No se pudo obtener la tasa BCV";

    return {
      name: GET_BCV_RATE_TOOL,
      ok: false,
      response: {
        ok: false,
        error: message,
        hint: "Di que no pudiste consultar la tasa del día. No inventes un valor.",
      },
    };
  }
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
        error: parsed.error.issues[0]?.message || "Documento inválido",
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

    const matches = await Promise.all(results.map((result) => summarizeMatch(result)));
    const singleSuspended =
      results.length === 1 && Boolean(results[0]?.invoicing.serviceSuspended);

    return {
      name: LOOKUP_WISPRO_TOOL,
      ok: true,
      response: {
        ok: true,
        cedula: parsed.data.cedula,
        count: results.length,
        matches,
        hint:
          results.length === 0
            ? "No se encontró abonado. Pide verificar la cédula."
            : results.length === 1
              ? singleSuspended
                ? "Servicio suspendido (service_suspended=true). Informa saldo, incentiva el pago y di que al registrar el comprobante se activa de forma inmediata. No menciones promesas internas."
                : "Un solo match. Informa saldo con debt_usd_formatted y debt_bs_formatted. Si hay comprobante pendiente, llama submit_payment_receipt."
              : "Varios matches. Confirma nombre/zona antes del pago. Revisa service_suspended por cada match.",
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
        service_suspended: Boolean(match.invoicing.serviceSuspended),
        contract_state: match.invoicing.contractState ?? null,
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

    // Silent Wispro payment promise. Never changes the client-facing message.
    // Failure must not undo or block the successful payment registration.
    let promiseMetadata: Record<string, unknown> = {
      payment_promise_created: false,
      payment_promise_source: "auto_submit",
    };
    let promiseCreated = false;

    try {
      const promiseResult = await createPaymentPromiseForClient({
        wisproClientId: payload.client_id,
        cedula: payload.cedula,
        hours: DEFAULT_PAYMENT_PROMISE_HOURS,
      });

      promiseCreated = promiseResult.ok;
      promiseMetadata = promiseResult.ok
        ? {
            payment_promise_created: true,
            payment_promise_id: promiseResult.promise.id,
            payment_promise_contract_id: promiseResult.contract.id,
            payment_promise_valid_until: promiseResult.validUntil,
            payment_promise_source: "auto_submit",
            payment_promise_error: null,
          }
        : {
            payment_promise_created: false,
            payment_promise_id: null,
            payment_promise_contract_id: null,
            payment_promise_valid_until: null,
            payment_promise_source: "auto_submit",
            payment_promise_error: promiseResult.error,
            payment_promise_skip_reason: promiseResult.reason,
          };
    } catch (promiseError) {
      console.warn("[AI_PAYMENT] promise_unexpected_error", {
        error:
          promiseError instanceof Error
            ? promiseError.message
            : String(promiseError),
      });
      promiseMetadata = {
        payment_promise_created: false,
        payment_promise_source: "auto_submit",
        payment_promise_error:
          promiseError instanceof Error
            ? promiseError.message
            : "Error inesperado al crear promesa",
      };
    }

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
            ...promiseMetadata,
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
        // Internal only — do not tell the WhatsApp client about promises.
        payment_promise_created: promiseCreated,
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

  if (
    ctx.allowedToolNames &&
    ctx.allowedToolNames.length > 0 &&
    !ctx.allowedToolNames.includes(toolName)
  ) {
    const blocked: ToolHandlerResult = {
      name: toolName,
      ok: false,
      response: {
        ok: false,
        error: `Tool no permitida en modo ${ctx.replyMode || "restricted"}: ${toolName}`,
        hint:
          ctx.replyMode === "after_hours_payments"
            ? "Fuera de oficina solo puedes gestionar pagos/comprobantes. Indica que un asesor atenderá el resto en horario laboral."
            : "Tool no disponible en este modo.",
      },
    };

    await auditToolInvocation(ctx.supabase, {
      conversationId: ctx.conversationId,
      runId: ctx.runId,
      toolName,
      args: rawArgs,
      result: blocked.response,
      ok: false,
      durationMs: Date.now() - started,
      error: String(blocked.response.error),
    });

    return blocked;
  }

  let result: ToolHandlerResult;

  switch (toolName) {
    case LOOKUP_WISPRO_TOOL:
      result = await handleLookup(ctx, rawArgs);
      break;
    case GET_BCV_RATE_TOOL:
      result = await handleGetBcvRate();
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
