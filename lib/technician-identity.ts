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
  /\b(pendiente(s)?|ticket(s)?|ruta|visita(s)?|casos?|cola|lote|asignad[oa]s?|listado)\b/i;

const TICKET_MONITOR_CAPTURE_RE =
  /\b(?:tickets?|casos?|pendientes?|cola|ruta|visitas?)\s+(?:(?:asignad[oa]s?|resuelt[oa]s?|cerrad[oa]s?|finalizad[oa]s?|terminad[oa]s?|completad[oa]s?|solucionad[oa]s?|atendid[oa]s?|pendientes?|abiert[oa]s?|todos)\s+)*(?:de|del|a|para)\s+(.+)$/i;

const TICKET_MONITOR_ASSIGNED_RE =
  /\b(?:asignad[oa]s?)\s+(?:a|de|para)\s+(.+)$/i;

const TICKET_MONITOR_HAS_RE =
  /\b(?:tiene|tienen|tenga|tienen?)\s+(.+)$/i;

const TICKET_COUNT_RE = /\b(cu[aá]ntos?|cu[aá]ntas?|total)\b/i;

const TICKET_LIST_VERB_RE =
  /\b(listado|lista|detalle|ficha|p[aá]sa(?:me)?|m[aá]nda(?:me)?|dame|env[ií]a(?:me)?)\b/i;

const OWN_TICKETS_RE = /\bmis\s+(tickets?|pendientes?|casos?|rutas?|cola)\b/i;

const MONITOR_NAME_TRAIL_RE =
  /\b(por\s+favor|please|hoy|ahora|mañana|ayer|semana|mes|d[ií]a(?:s)?|pendientes?|tickets?|casos?|asignad[oa]s?|resuelt[oa]s?|cerrad[oa]s?|finalizad[oa]s?|terminad[oa]s?|completad[oa]s?|solucionad[oa]s?|atendid[oa]s?|abiert[oa]s?|todos|el|la|los|las|de|del|al|a|para)\b/gi;

const TICKET_LIST_SCOPE_RE =
  /\b(pendiente(s)?|ruta|lote|asignad[oa]s?|listado|todos(?:\s+los)?(?:\s+tickets)?|mis\s+(tickets|casos|pendientes)|los\s+tickets|(?:tickets?|casos?|pendientes?|visitas?|cola|rutas?)\s+(?:del?\s+|para(?:\s+el)?\s+|de\s+)?(?:(?:este\s+)?d[ií]a(?:\s+(?:de\s+)?(?:hoy|mañana|ayer))?|hoy|mañana|ayer|ahora|esta\s+semana|este\s+mes))\b/i;

const TICKET_DETAIL_KEYWORD_RE =
  /\b(detalle|ficha|completo|m[aá]s\s+(datos|info|informaci[oó]n)|foto(?:s)?\s+d(?:e|el|la)|fachada)\b/i;

const TICKET_DETAIL_PUBLIC_ID_RE =
  /#\s*(\d{3,})\b|\b(?:ticket|caso)\s+#?\s*(\d{3,})\b/i;

const TICKET_DETAIL_INDEX_RE =
  /(?:^|[\s,.;:!?¿¡])(?:el|n(?:u|ú)mero|nro|n[º°]|#)?\s*(\d{1,2})(?=$|[\s,.;:!?])/i;

const NEXT_PAGE_RE = /\b(siguiente(s)?|prox(imo|ima)|otro lote|m[aá]s tickets)\b/i;

const RESEND_RE = /\b(reenvia(r)?|mand(a|ame) de nuevo|otra vez|repet(i|í)r)\b/i;

const TECHNICIAN_ROLE_RE =
  /\b(soy (el |la )?t[eé]cnic[oa]s?|mis (tickets|pendientes|casos)|mi ruta)\b/i;

const OFFER_ACCEPT_RE =
  /^(s[ií]+|dale|ok+|okay|va|claro|por favor)([!.,\s].*)?$/i;

const OFFER_ACCEPT_ACTION_RE =
  /\b(env[ií]a(me|los|las)?|p[aá]sa(me|los|las)?|m[aá]nda(me|los|las)?|d[aá]me(los|las)?)\b/i;

const PAYMENT_OVERRIDE_RE =
  /\b(soy cliente|quiero pagar|comprobante|transferencia|pago|tpago|pago m[oó]vil)\b/i;

const FINALIZE_VERB_RE =
  /(?:^|[\s,.;:!?¿¡])(?:cierra(?:r)?|cerr[aá]|finaliza(?:r)?|termin(?:e|é|ó)|complet(?:e|é)|resuelto|ya(?:\s+est[aá])?\s+listo)(?=$|[\s,.;:!?])/i;

const FINALIZE_TARGET_RE =
  /(?:ticket|caso|visita|#\s*\d{2,}|\d{3,})/i;

const FINALIZE_LEADING_FILLER_RE =
  /^(?:el|la|los|las|de|del|al|a|para|un|una|mi|mis|su|sus|tu|tus|este|esta|ese|esa|por\s+favor|please)[\s,]+/i;

const FINALIZE_NAME_RE = /^[\p{L}][\p{L}\s.'’-]{1,79}$/u;

const TECHNICIAN_LIST_OFFER_RE = /listado de tickets pendientes/i;

const TECHNICIAN_GREETING_RE =
  /^(hola|buenas|buen(os|as)\s+(d[ií]as|tardes|noches)|saludos)([!.,\s].*)?$/i;

const DETAIL_NAME_NOISE_RE =
  /\b(?:detalle|ficha|completo|foto(?:s)?|fachada|p[aá]sa(?:me)?|m[aá]nda(?:me)?|env[ií]a(?:me)?|dame|por\s+favor|please|el|la|los|las|de|del|al|a|para|un|una|mi|mis|su|sus|tu|tus|tickets?|casos?|visitas?|rutas?|cola|n[uú]mero|nro|pendiente(?:s)?|m[aá]s|datos|info|informaci[oó]n|d[ií]a(?:s)?|hoy|mañana|ayer|ahora|semana|mes)\b/gi;

const BARE_CLIENT_NAME_BLOCKLIST_RE =
  /^(hola|gracias|ok+|okay|dale|va|claro|listo|bueno|espera|ahora|ya|bien|perfecto|entendido|pendientes?|tickets?|casos?|visitas?|ruta|siguiente|reenviar|saludos|buenas?|d[ií]as?|hoy|mañana|ayer|semana|mes|cola|mis?|sus?|tus?|tardes|noches|ayuda|men[uú]|t[eé]cnic[oa]s?|audio|imagen|video|foto|fotos|documento|ubicaci[oó]n|nota de voz|voz|sticker)$/i;

const stripFinalizeFillers = (value: string) => {
  let rest = value.replace(/\s+/g, " ").trim();
  rest = rest.replace(/[\s,]+(?:por\s+favor|please)$/i, "").trim();
  while (true) {
    const next = rest.replace(FINALIZE_LEADING_FILLER_RE, "").trim();
    if (next === rest) break;
    rest = next;
  }
  return rest;
};

const looksLikeFinalizeClientName = (value: string) => {
  const rest = stripFinalizeFillers(value);
  if (rest.length < 3 || rest.length > 80) return false;
  const words = rest.split(/\s+/).filter(Boolean);
  if (words.length < 1 || words.length > 6) return false;
  return FINALIZE_NAME_RE.test(rest);
};

export const looksLikeOtpCode = (value: string | null | undefined) => {
  const text = String(value || "").trim();
  if (!text) return false;
  const digits = text.replace(/\D/g, "");
  return digits.length === 6 && /^[\d\s-]+$/.test(text);
};

export type TechnicianTicketDetailQuery = {
  publicId: number | null;
  clientName: string | null;
  listIndex: number | null;
};

export const parseTechnicianTicketDetailQuery = (
  value: string | null | undefined,
): TechnicianTicketDetailQuery => {
  const text = String(value || "").replace(/\s+/g, " ").trim();
  if (!text) {
    return { publicId: null, clientName: null, listIndex: null };
  }

  const publicIdMatch = TICKET_DETAIL_PUBLIC_ID_RE.exec(text);
  const publicIdRaw = publicIdMatch?.[1] || publicIdMatch?.[2] || null;
  const publicId = publicIdRaw ? Number.parseInt(publicIdRaw, 10) : null;

  let listIndex: number | null = null;
  if (publicId == null) {
    if (/^\d{1,2}$/.test(text)) {
      listIndex = Number.parseInt(text, 10);
    } else {
      const indexMatch = TICKET_DETAIL_INDEX_RE.exec(text);
      if (indexMatch?.[1]) {
        const parsed = Number.parseInt(indexMatch[1], 10);
        if (parsed >= 1 && parsed <= 99) listIndex = parsed;
      }
    }
  }

  let clientName: string | null = null;
  if (publicId == null) {
    const rest = text
      .replace(TICKET_DETAIL_KEYWORD_RE, " ")
      .replace(DETAIL_NAME_NOISE_RE, " ")
      .replace(/#?\d+/g, " ")
      .replace(/\s+/g, " ")
      .trim();
    if (
      rest.length >= 3 &&
      !BARE_CLIENT_NAME_BLOCKLIST_RE.test(rest) &&
      looksLikeFinalizeClientName(rest)
    ) {
      clientName = rest;
    }
  }

  return {
    publicId: publicId != null && Number.isFinite(publicId) ? publicId : null,
    clientName,
    listIndex,
  };
};

export const looksLikeTechnicianTicketRequest = (
  value: string | null | undefined,
) => TICKET_REQUEST_RE.test(String(value || ""));

export type TechnicianTicketScope = "pending" | "done" | "all";

export const parseTechnicianTicketScope = (
  value: string | null | undefined,
): TechnicianTicketScope => {
  const text = String(value || "").toLowerCase();
  if (/\b(todos|todas|ambos)\b/i.test(text)) return "all";
  if (
    /\b(resuelt[oa]s?|cerrad[oa]s?|finalizad[oa]s?|terminad[oa]s?|completad[oa]s?|solucionad[oa]s?|atendid[oa]s?)\b/i.test(
      text,
    )
  ) {
    return "done";
  }
  return "pending";
};

export type MonitoredTechnicianQuery = {
  names: string[];
  wantsCountOnly: boolean;
  scope: TechnicianTicketScope;
};

const cleanMonitoredNameChunk = (value: string) =>
  value
    .replace(MONITOR_NAME_TRAIL_RE, " ")
    .replace(/[¿?¡!.,;:]+/g, " ")
    .replace(/\s+/g, " ")
    .trim();

export const parseMonitoredTechnicianQuery = (
  value: string | null | undefined,
): MonitoredTechnicianQuery => {
  const text = String(value || "").replace(/\s+/g, " ").trim();
  if (!text) return { names: [], wantsCountOnly: false, scope: "pending" };

  const captured =
    TICKET_MONITOR_CAPTURE_RE.exec(text)?.[1] ||
    TICKET_MONITOR_ASSIGNED_RE.exec(text)?.[1] ||
    ((TICKET_REQUEST_RE.test(text) || TICKET_COUNT_RE.test(text)) &&
      TICKET_MONITOR_HAS_RE.exec(text)?.[1]) ||
    "";
  const cleaned = cleanMonitoredNameChunk(captured);
  const names = cleaned
    .split(/\s+(?:y|e|,)\s+/i)
    .map((item) => cleanMonitoredNameChunk(item))
    .filter((item) => item.length >= 3 && !OWN_TICKETS_RE.test(item));

  const wantsCountOnly =
    TICKET_COUNT_RE.test(text) && !TICKET_LIST_VERB_RE.test(text);
  const scope = parseTechnicianTicketScope(text);

  return { names, wantsCountOnly, scope };
};

export const looksLikeMonitoredTechnicianQuery = (
  value: string | null | undefined,
) => parseMonitoredTechnicianQuery(value).names.length > 0;

export const looksLikeTechnicianTicketDetailRequest = (
  value: string | null | undefined,
) => {
  if (looksLikeTechnicianFinalizeRequest(value)) return false;
  if (looksLikeTechnicianNextPage(value)) return false;
  if (looksLikeTechnicianResend(value)) return false;
  const text = String(value || "").replace(/\s+/g, " ").trim();
  if (!text) return false;
  if (
    /^(?:(?:mis|los|el)\s+)?(?:tickets?|pendientes?|casos?|visitas?|ruta|cola)(?:\s+(?:del?\s+|para(?:\s+el)?\s+|de\s+)?(?:(?:este\s+)?d[ií]a(?:\s+(?:de\s+)?(?:hoy|mañana|ayer))?|hoy|mañana|ayer|ahora|esta\s+semana|este\s+mes))?(?:[\s.,;:]+(?:por\s+favor|please))?$/i.test(
      text,
    )
  ) {
    return false;
  }
  if (
    /^(audio|imagen|video|foto|fotos|documento|ubicaci[oó]n|nota de voz|voz|sticker)$/i.test(
      text,
    )
  ) {
    return false;
  }
  const hasListScope = TICKET_LIST_SCOPE_RE.test(text);
  const hasDetailKeyword = TICKET_DETAIL_KEYWORD_RE.test(text);
  if (hasListScope && !hasDetailKeyword) return false;
  if (
    /\b(?:esa|ese|eso|esta|este)\s+de\b/i.test(text) &&
    !hasDetailKeyword
  ) {
    return false;
  }
  if (hasDetailKeyword) return true;

  const query = parseTechnicianTicketDetailQuery(text);
  if (query.publicId != null || query.listIndex != null) return true;
  if (query.clientName) return true;
  return false;
};

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

export const looksLikeTechnicianListOffer = (
  value: string | null | undefined,
) => TECHNICIAN_LIST_OFFER_RE.test(String(value || ""));

export const looksLikeBareTechnicianGreeting = (
  value: string | null | undefined,
) => {
  const text = String(value || "").trim();
  if (!text || text.length > 40) return false;
  return TECHNICIAN_GREETING_RE.test(text);
};

export const formatTechnicianWelcome = (name: string | null | undefined) =>
  `Hola ${technicianFirstName(name)}. Te identifiqué como técnico. ¿Quieres que te envíe tu listado de tickets pendientes?`;

export const formatSupervisorWelcome = (name: string | null | undefined) =>
  `Hola ${technicianFirstName(name)}. Te identifiqué como supervisor. Puedes consultar los tickets del equipo diciendo «tickets», consultar un técnico por nombre («tickets de Joel») o pedir «mis tickets» para tus propias asignaciones.`;

export const formatTechnicianAgentQueue = (
  items: Array<{
    publicId: number | null;
    clientName: string | null;
    cause: string | null;
  }>,
) =>
  items
    .slice(0, 8)
    .map(
      (item) =>
        `- #${item.publicId ?? "s/n"} · ${item.clientName || "sin nombre"} · ${item.cause || "sin causa"}`,
    )
    .join("\n");

export const looksLikeCustomerPaymentOverride = (
  value: string | null | undefined,
) => PAYMENT_OVERRIDE_RE.test(String(value || ""));

export const looksLikeTechnicianFinalizeRequest = (
  value: string | null | undefined,
) => {
  const text = String(value || "").trim();
  if (!text) return false;
  const verbMatch = FINALIZE_VERB_RE.exec(text);
  if (!verbMatch) return false;
  if (FINALIZE_TARGET_RE.test(text)) return true;
  const remainder = [
    text.slice(0, verbMatch.index),
    text.slice(verbMatch.index + verbMatch[0].length),
  ]
    .join(" ")
    .replace(/\s+/g, " ")
    .trim();
  return looksLikeFinalizeClientName(remainder);
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

export const shouldDeliverTechnicianTicketDetail = (input: {
  inboundText: string | null | undefined;
}) => {
  if (looksLikeTechnicianFinalizeRequest(input.inboundText)) return false;
  return looksLikeTechnicianTicketDetailRequest(input.inboundText);
};

export const looksLikeSupervisorOwnTicketsRequest = (
  value: string | null | undefined,
): boolean => {
  const text = String(value || "").trim();
  if (!text) return false;
  return (
    /\b(?:mis\s+(?:tickets?|pendientes?|casos?|rutas?|cola)|mi\s+(?:ruta|cola)|asignad[oa]s?\s+a\s+m[ií]|tengo\b.*?\basignad[oa]|lo\s+m[ií]o)\b/i.test(
      text,
    )
  );
};

export const looksLikeSupervisorTeamTicketsRequest = (
  value: string | null | undefined,
): boolean => {
  const text = String(value || "").trim();
  if (!text) return false;
  if (looksLikeTechnicianFinalizeRequest(text)) return false;
  if (looksLikeSupervisorOwnTicketsRequest(text)) return false;
  if (looksLikeMonitoredTechnicianQuery(text)) return false;

  return /\b(?:tickets?|casos?|pendientes?|visitas?|cola|rutas?|listado)\b/i.test(
    text,
  );
};

export type TemporalDateFilter = "today" | "tomorrow" | "all";

export const parseTemporalDateFilter = (
  text: string | null | undefined,
): TemporalDateFilter => {
  const s = String(text || "").toLowerCase();
  if (/\b(?:mañana|manana)\b/i.test(s)) return "tomorrow";
  if (/\b(?:hoy|ahora|este\s+d[ií]a|del\s+d[ií]a)\b/i.test(s)) return "today";
  return "all";
};

export const getCaracasDateKey = (dateOffsetDays = 0): string => {
  const d = new Date(Date.now() + dateOffsetDays * 24 * 60 * 60 * 1000);
  return new Intl.DateTimeFormat("es-VE", {
    timeZone: "America/Caracas",
    day: "2-digit",
    month: "2-digit",
    year: "numeric",
  }).format(d);
};

export const shouldDeliverSupervisorTeamTickets = (input: {
  isSupervisor: boolean;
  inboundText: string | null | undefined;
}): boolean => {
  if (!input.isSupervisor) return false;
  return looksLikeSupervisorTeamTicketsRequest(input.inboundText);
};

export const shouldDeliverTechnicianTickets = (input: {
  justVerified: boolean;
  inboundText: string | null | undefined;
  inboundIsCedula: boolean;
  listOfferPending?: boolean;
  isSupervisor?: boolean;
}) => {
  if (looksLikeTechnicianFinalizeRequest(input.inboundText)) return false;
  if (input.isSupervisor) {
    return looksLikeSupervisorOwnTicketsRequest(input.inboundText);
  }
  if (shouldDeliverTechnicianTicketDetail({ inboundText: input.inboundText })) {
    return false;
  }
  if (looksLikeMonitoredTechnicianQuery(input.inboundText)) return false;
  if (looksLikeTechnicianTicketRequest(input.inboundText)) return true;
  if (looksLikeTechnicianNextPage(input.inboundText)) return true;
  if (looksLikeTechnicianResend(input.inboundText)) return true;
  if (looksLikeTechnicianOfferAccept(input.inboundText)) {
    return Boolean(input.listOfferPending);
  }
  if (input.inboundIsCedula && !input.justVerified) return true;
  return false;
};

export const shouldDeliverMonitoredTechnicianQueue = (input: {
  isSupervisor: boolean;
  inboundText: string | null | undefined;
}) => {
  if (!input.isSupervisor) return false;
  if (looksLikeTechnicianFinalizeRequest(input.inboundText)) return false;
  const query = parseMonitoredTechnicianQuery(input.inboundText);
  return query.names.length === 1 && !query.wantsCountOnly;
};

export const shouldUseCannedTechnicianWelcome = (input: {
  justVerified: boolean;
  inboundText: string | null | undefined;
  inboundIsCedula: boolean;
}) => {
  if (!input.justVerified) return false;
  if (
    shouldDeliverTechnicianTickets({
      ...input,
      listOfferPending: false,
    })
  ) {
    return false;
  }
  if (input.inboundIsCedula) return true;
  const text = String(input.inboundText || "").trim();
  if (
    !text ||
    looksLikeBareTechnicianGreeting(text) ||
    /^(audio|imagen|video|foto|fotos|documento|ubicaci[oó]n|nota de voz|voz|sticker)$/i.test(
      text,
    )
  ) {
    return true;
  }
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
