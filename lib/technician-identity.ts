import { documentDigits, phoneLast10 } from "./phone-match";

export type TechnicianIdentityRow = {
  id: string;
  employeeId: string;
  name: string;
  phoneLast10: string | null;
  whatsappPhoneLast10: string | null;
  active: boolean;
};

export type TechnicianVerificationMethod =
  | "registered_phone"
  | "whatsapp_bound"
  | "document_and_phone"
  | "otp";

export type TechnicianVerificationDecision =
  | { action: "verified"; method: TechnicianVerificationMethod }
  | { action: "need_otp" }
  | { action: "need_registered_phone" }
  | { action: "inactive" }
  | { action: "customer" };

export type TechnicianIdentitySignals = {
  technician: TechnicianIdentityRow | null;
  inboundLast10: string | null;
  hasDocumentMatch: boolean;
  claimsTechnicianRole: boolean;
  conversationIsTechnician: boolean;
  otpValid: boolean;
  paymentOverride: boolean;
};

const TICKET_REQUEST_RE =
  /\b(pendiente(s)?|ticket(s)?|ruta|visita(s)?|casos?|lote|asignad[oa]s?|listado)\b/i;

const NEXT_PAGE_RE = /\b(siguiente(s)?|prox(imo|ima)|otro lote|m[aá]s tickets)\b/i;

const RESEND_RE = /\b(reenvia(r)?|mand(a|ame) de nuevo|otra vez|repet(i|í)r)\b/i;

const TECHNICIAN_ROLE_RE =
  /\b(soy (el |la )?t[eé]cnic[oa]s?|mis (tickets|pendientes|casos)|mi ruta)\b/i;

const OFFER_ACCEPT_RE =
  /^(s[ií]+|dale|ok+|okay|va|claro|listo|por favor)([!.,\s].*)?$/i;

const OFFER_ACCEPT_ACTION_RE =
  /\b(env[ií]a(me|los|las)?|p[aá]sa(me|los|las)?|m[aá]nda(me|los|las)?|d[aá]me(los|las)?)\b/i;

const PAYMENT_OVERRIDE_RE =
  /\b(soy cliente|quiero pagar|comprobante|transferencia|pago|tpago|pago m[oó]vil)\b/i;

const FINALIZE_VERB_RE =
  /(?:^|[\s,.;:!?¿¡])(?:cierra(?:r)?|cerr[aá]|finaliza(?:r)?|termin(?:e|é|ó)|complet(?:e|é)|resuelto|ya(?:\s+est[aá])?\s+listo)(?=$|[\s,.;:!?])/i;

const FINALIZE_TARGET_RE =
  /(?:ticket|caso|visita|#\s*\d{2,}|\d{3,})/i;

export const looksLikeOtpCode = (value: string | null | undefined) => {
  const text = String(value || "").trim();
  if (!text) return false;
  const digits = text.replace(/\D/g, "");
  return digits.length === 6 && /^[\d\s-]+$/.test(text);
};

export const looksLikeTechnicianTicketRequest = (
  value: string | null | undefined,
) => TICKET_REQUEST_RE.test(String(value || ""));

export const looksLikeTechnicianNextPage = (value: string | null | undefined) =>
  NEXT_PAGE_RE.test(String(value || ""));

export const looksLikeTechnicianResend = (value: string | null | undefined) =>
  RESEND_RE.test(String(value || ""));

export const looksLikeTechnicianRoleClaim = (
  value: string | null | undefined,
) => TECHNICIAN_ROLE_RE.test(String(value || ""));

export const looksLikeTechnicianOfferAccept = (
  value: string | null | undefined,
) => {
  const text = String(value || "").trim();
  if (!text || text.length > 80) return false;
  return OFFER_ACCEPT_RE.test(text) || OFFER_ACCEPT_ACTION_RE.test(text);
};

export const formatTechnicianWelcome = (name: string | null | undefined) =>
  `Hola ${technicianFirstName(name)}. Te identifiqué como técnico. ¿Quieres que te envíe tu listado de tickets pendientes?`;

export const formatTechnicianOffer = (name: string | null | undefined) =>
  `Hola ${technicianFirstName(name)}. ¿Quieres que te envíe tu listado de tickets pendientes?`;

export const looksLikeCustomerPaymentOverride = (
  value: string | null | undefined,
) => PAYMENT_OVERRIDE_RE.test(String(value || ""));

export const looksLikeTechnicianFinalizeRequest = (
  value: string | null | undefined,
) => {
  const text = String(value || "").trim();
  if (!text) return false;
  return FINALIZE_VERB_RE.test(text) && FINALIZE_TARGET_RE.test(text);
};

export const technicianFirstName = (name: string | null | undefined) => {
  const first = String(name || "")
    .trim()
    .split(/\s+/)[0];
  return first || "técnico";
};

export const decideTechnicianVerification = (
  input: TechnicianIdentitySignals,
): TechnicianVerificationDecision => {
  if (input.paymentOverride && !input.conversationIsTechnician) {
    return { action: "customer" };
  }

  const technician = input.technician;
  if (!technician) return { action: "customer" };
  if (!technician.active) return { action: "inactive" };

  if (input.otpValid) {
    return { action: "verified", method: "otp" };
  }

  const inbound = phoneLast10(input.inboundLast10);
  const bound = phoneLast10(technician.whatsappPhoneLast10);
  const registered = phoneLast10(technician.phoneLast10);
  const phoneMatchesBound = Boolean(inbound && bound && inbound === bound);
  const phoneMatchesRegistered = Boolean(
    inbound && registered && inbound === registered,
  );

  if (phoneMatchesBound) {
    return { action: "verified", method: "whatsapp_bound" };
  }

  if (phoneMatchesRegistered && input.hasDocumentMatch) {
    return { action: "verified", method: "document_and_phone" };
  }

  if (phoneMatchesRegistered) {
    return { action: "verified", method: "registered_phone" };
  }

  const wantsTechnicianFlow =
    input.conversationIsTechnician ||
    input.claimsTechnicianRole ||
    input.hasDocumentMatch;

  if (wantsTechnicianFlow && input.hasDocumentMatch) {
    if (!registered && !bound) return { action: "need_registered_phone" };
    return { action: "need_otp" };
  }

  if (input.conversationIsTechnician && (bound || registered)) {
    return { action: "need_otp" };
  }

  return { action: "customer" };
};

export const shouldDeliverTechnicianTickets = (input: {
  justVerified: boolean;
  inboundText: string | null | undefined;
  inboundIsCedula: boolean;
}) => {
  if (looksLikeTechnicianFinalizeRequest(input.inboundText)) return false;
  if (looksLikeTechnicianTicketRequest(input.inboundText)) return true;
  if (looksLikeTechnicianNextPage(input.inboundText)) return true;
  if (looksLikeTechnicianResend(input.inboundText)) return true;
  if (looksLikeTechnicianOfferAccept(input.inboundText)) return true;
  if (input.inboundIsCedula && !input.justVerified) return true;
  return false;
};

export const resolveTechnicianPageOffset = (input: {
  storedOffset: number;
  inboundText: string | null | undefined;
  pageSize: number;
  total: number;
}) => {
  if (looksLikeTechnicianNextPage(input.inboundText)) {
    const next = Math.max(0, input.storedOffset);
    return next >= input.total ? 0 : next;
  }
  return 0;
};

export { documentDigits, phoneLast10 };
