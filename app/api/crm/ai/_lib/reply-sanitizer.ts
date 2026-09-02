import {
  ESCALATE_HUMAN_TOOL,
  GET_BCV_RATE_TOOL,
  LINK_WISPRO_TOOL,
  LOOKUP_WISPRO_TOOL,
  SUBMIT_PAYMENT_RECEIPT_TOOL,
} from "./gemini-tools";

/** Tool names Nova must never echo to WhatsApp customers. */
export const CUSTOMER_VISIBLE_TOOL_NAMES = [
  LOOKUP_WISPRO_TOOL,
  LINK_WISPRO_TOOL,
  ESCALATE_HUMAN_TOOL,
  SUBMIT_PAYMENT_RECEIPT_TOOL,
  GET_BCV_RATE_TOOL,
] as const;

export type ToolLeakMatch = {
  matched: true;
  reason: string;
  matchedToken: string;
};

export type ToolLeakMiss = {
  matched: false;
};

export type ToolLeakResult = ToolLeakMatch | ToolLeakMiss;

const TOOL_DESCRIPTION_FRAGMENTS = [
  "registra el comprobante en el api de pagos",
  "requiere lookup_wispro_by_cedula previo",
  "busca al abonado en wispro por cédula",
  "busca al abonado en wispro por cedula",
  "escala a un asesor humano",
  "consulta la tasa bcv/dólar",
  "consulta la tasa bcv/dolar",
  "functiondeclarations",
  "functioncallingconfig",
  "functionresponse",
  "functioncall",
] as const;

const SAFE_CUSTOMER_REPLY =
  "Recibí tu mensaje. Dame un momento para procesarlo. Si puedes, indícame tu número de cédula (solo números) por aquí 😊";

const TOOL_NAME_PATTERN = new RegExp(
  `\\b(?:${CUSTOMER_VISIBLE_TOOL_NAMES.join("|")})\\b`,
  "i",
);

const TOOL_PSEUDO_CALL_PATTERN = new RegExp(
  `\\b(?:${CUSTOMER_VISIBLE_TOOL_NAMES.join("|")})\\s*[:(]`,
  "i",
);

/**
 * Detects when Gemini dumps tool names / schema into customer-facing text
 * instead of emitting a real functionCall.
 */
export const detectToolLeakInCustomerReply = (
  text: string,
): ToolLeakResult => {
  const trimmed = text.trim();
  if (!trimmed) return { matched: false };

  const normalized = trimmed.toLowerCase().replace(/\s+/g, " ");

  const pseudoCall = trimmed.match(TOOL_PSEUDO_CALL_PATTERN);
  if (pseudoCall?.[0]) {
    return {
      matched: true,
      reason: "tool_pseudo_call",
      matchedToken: pseudoCall[0].trim(),
    };
  }

  const toolName = trimmed.match(TOOL_NAME_PATTERN);
  if (toolName?.[0]) {
    return {
      matched: true,
      reason: "tool_name_in_reply",
      matchedToken: toolName[0],
    };
  }

  for (const fragment of TOOL_DESCRIPTION_FRAGMENTS) {
    if (normalized.includes(fragment)) {
      return {
        matched: true,
        reason: "tool_description_fragment",
        matchedToken: fragment,
      };
    }
  }

  return { matched: false };
};

export const isUnsafeCustomerReply = (text: string) =>
  detectToolLeakInCustomerReply(text).matched;

/** Customer-safe message when a leaked tool reply is blocked. */
export const SAFE_TOOL_LEAK_CUSTOMER_REPLY = SAFE_CUSTOMER_REPLY;

export const CUSTOMER_REPLY_SANITIZE_INSTRUCTION = [
  "IMPORTANTE: responde SOLO al cliente en español claro por WhatsApp.",
  "PROHIBIDO escribir nombres de herramientas, descriptions de tools, JSON, functionCall o texto técnico interno.",
  "Nunca menciones submit_payment_receipt, lookup_wispro_by_cedula, link_wispro_client, escalate_to_human ni get_bcv_rate.",
  "Si necesitas una herramienta, el sistema la invocará; tú solo habla con el cliente.",
].join(" ");
