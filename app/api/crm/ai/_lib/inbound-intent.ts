import type { AgentHistoryMessage } from "./context-builder";

export type InboundIntent =
  | "human_request"
  | "receipt_image"
  | "cedula"
  | "cedula_and_image"
  | "general";

const HUMAN_REQUEST_RE =
  /\b(asesor(a)?|humano|persona real|operador(a)?|atenci[oó]n (al )?cliente|hablar con (un |una )?(agente|persona|alguien|asesor)|pasar(me)? (con |a )?(un |una )?(asesor|agente|humano)|quiero (un |una )?(asesor|agente|humano)|necesito (un |una )?(asesor|agente|humano))\b/i;

const isUserMessage = (message: AgentHistoryMessage) =>
  message.type === "in" || message.sender_type === "client";

export const looksLikeCedula = (value: string | null | undefined) => {
  const digits = String(value || "").replace(/\D/g, "");
  return digits.length >= 5 && digits.length <= 12 && /^\d+$/.test(digits);
};

export const looksLikeHumanRequest = (value: string | null | undefined) =>
  HUMAN_REQUEST_RE.test(String(value || "").trim());

export const inboundHasImage = (message: AgentHistoryMessage | null | undefined) =>
  String(message?.media_type || "").toLowerCase() === "image";

export const recentInboundHasImage = (messages: AgentHistoryMessage[]) =>
  messages.some(
    (message) => isUserMessage(message) && inboundHasImage(message),
  );

const resolveInboundText = (message: AgentHistoryMessage | null | undefined) =>
  [message?.content, message?.caption]
    .map((value) => String(value || "").trim())
    .filter(Boolean)
    .join(" ");

export const classifyInboundIntent = (input: {
  latestInbound?: AgentHistoryMessage | null;
  messages?: AgentHistoryMessage[];
}): InboundIntent => {
  const text = resolveInboundText(input.latestInbound);
  const hasImage =
    inboundHasImage(input.latestInbound) ||
    recentInboundHasImage(input.messages || []);
  const hasCedula = looksLikeCedula(text) || looksLikeCedula(input.latestInbound?.content);

  if (looksLikeHumanRequest(text)) return "human_request";
  if (hasCedula && hasImage) return "cedula_and_image";
  if (hasCedula) return "cedula";
  if (hasImage) return "receipt_image";
  return "general";
};
