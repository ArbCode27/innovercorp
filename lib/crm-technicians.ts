import type { SupabaseClient } from "@supabase/supabase-js";
import { documentDigits, digitsOnly, phoneLast10 } from "./phone-match";
import {
  documentLast4,
  generateTechnicianOtp,
  hashTechnicianDocument,
  hashTechnicianOtp,
  resolveTechnicianHmacSecret,
  secretsEqual,
} from "./technician-crypto";
import {
  decideTechnicianVerification,
  looksLikeOtpCode,
  technicianFirstName,
  type TechnicianIdentityRow,
  type TechnicianVerificationMethod,
} from "./technician-identity";
import { listTechnicians } from "./wispro";
import type { WisproEmployee } from "./wispro-types";
import { sendWhatsAppText } from "./whatsapp-outbound";

const LOG_PREFIX = "[TECHNICIANS]";
const OTP_TTL_MS = 10 * 60 * 1000;
const CHALLENGE_RATE_LIMIT = 5;

export type CrmTechnician = {
  id: string;
  employeeId: string;
  name: string;
  documentLast4: string | null;
  phone: string | null;
  phoneLast10: string | null;
  whatsappPhone: string | null;
  whatsappPhoneLast10: string | null;
  whatsappVerifiedAt: string | null;
  whatsappVerificationMethod: string | null;
  active: boolean;
};

type MatchedEmployee = {
  id: string;
  name: string;
  phone: string | null;
  document: string | null;
};

export type TechnicianSessionStatus =
  | "customer"
  | "verified"
  | "challenge_sent"
  | "challenge_failed"
  | "need_registered_phone"
  | "inactive";

export type TechnicianSession = {
  status: TechnicianSessionStatus;
  technician: CrmTechnician | null;
  employee: MatchedEmployee | null;
  justVerified: boolean;
  method: TechnicianVerificationMethod | null;
  message: string | null;
  reason: string;
  reportOffset: number;
};

export type TechnicianInboundInput = {
  conversationId: number;
  phone?: string | null;
  text?: string | null;
  hasImage?: boolean;
  cedula?: string | null;
  otp?: string | null;
  claimsTechnicianRole?: boolean;
  paymentOverride?: boolean;
};

const isMissingSchema = (error: { message?: string; code?: string } | null) => {
  if (!error) return false;
  const message = String(error.message || "");
  return (
    error.code === "42P01" ||
    error.code === "42703" ||
    /does not exist/i.test(message) ||
    /schema cache/i.test(message)
  );
};

const toE164Digits = (value: string | null | undefined) => {
  const digits = digitsOnly(value);
  return digits.length >= 8 ? digits : null;
};

const fromTechnicianRow = (row: Record<string, unknown>): CrmTechnician => ({
  id: String(row.id),
  employeeId: String(row.employee_id),
  name: String(row.name || "Técnico"),
  documentLast4: (row.document_last4 as string | null) ?? null,
  phone: (row.phone_e164 as string | null) ?? null,
  phoneLast10: (row.phone_last10 as string | null) ?? null,
  whatsappPhone: (row.whatsapp_phone_e164 as string | null) ?? null,
  whatsappPhoneLast10: (row.whatsapp_phone_last10 as string | null) ?? null,
  whatsappVerifiedAt: (row.whatsapp_verified_at as string | null) ?? null,
  whatsappVerificationMethod:
    (row.whatsapp_verification_method as string | null) ?? null,
  active: row.active !== false,
});

const toIdentityRow = (technician: CrmTechnician): TechnicianIdentityRow => ({
  id: technician.id,
  employeeId: technician.employeeId,
  name: technician.name,
  phoneLast10: technician.phoneLast10,
  whatsappPhoneLast10: technician.whatsappPhoneLast10,
  active: technician.active,
});

const toMatchedEmployee = (technician: CrmTechnician): MatchedEmployee => ({
  id: technician.employeeId,
  name: technician.name,
  phone: technician.whatsappPhone || technician.phone,
  document: technician.documentLast4,
});

const emptyCustomerSession = (reason: string): TechnicianSession => ({
  status: "customer",
  technician: null,
  employee: null,
  justVerified: false,
  method: null,
  message: null,
  reason,
  reportOffset: 0,
});

export const recordTechnicianEvent = async (
  supabase: SupabaseClient,
  input: {
    technicianId?: string | null;
    conversationId?: number | null;
    event: string;
    method?: string | null;
    metadata?: Record<string, unknown>;
  },
) => {
  try {
    const { error } = await supabase.from("crm_technician_events").insert({
      technician_id: input.technicianId ?? null,
      conversation_id: input.conversationId ?? null,
      event: input.event,
      method: input.method ?? null,
      metadata: input.metadata ?? {},
    });
    if (error && !isMissingSchema(error)) {
      console.warn(`${LOG_PREFIX} audit_failed`, error.message);
    }
  } catch (error) {
    console.warn(`${LOG_PREFIX} audit_unexpected`, error);
  }
};

const readHmacSecret = () => {
  const secret = resolveTechnicianHmacSecret();
  if (!secret) {
    console.warn(`${LOG_PREFIX} missing_hmac_secret`);
  }
  return secret;
};

export const upsertCrmTechnicianFromEmployee = async (
  supabase: SupabaseClient,
  employee: WisproEmployee,
) => {
  const secret = readHmacSecret();
  if (!secret) return false;
  const now = new Date().toISOString();
  const document = documentDigits(employee.national_identification_number);
  const phone = employee.phone_mobile || employee.phone;
  const { error } = await supabase.from("crm_technicians").upsert(
    {
      employee_id: employee.id,
      name: employee.name,
      document_hash: document ? hashTechnicianDocument(document, secret) : null,
      document_last4: documentLast4(document),
      phone_e164: toE164Digits(phone),
      phone_last10: phoneLast10(phone),
      active: true,
      source_updated_at: employee.updated_at || now,
      updated_at: now,
    },
    { onConflict: "employee_id" },
  );
  if (error) {
    if (!isMissingSchema(error)) {
      console.warn(`${LOG_PREFIX} upsert_failed`, {
        employeeId: employee.id,
        error: error.message,
      });
    }
    return false;
  }
  return true;
};

export const syncCrmTechnicians = async (
  supabase: SupabaseClient,
  input?: { forceRefresh?: boolean; employees?: WisproEmployee[] },
) => {
  const secret = readHmacSecret();
  if (!secret) return { ok: false as const, upserted: 0, deactivated: 0 };

  let employees = input?.employees;
  if (!employees) {
    try {
      employees = await listTechnicians({
        forceRefresh: Boolean(input?.forceRefresh),
      });
    } catch (error) {
      console.warn(`${LOG_PREFIX} sync_list_failed`, error);
      return { ok: false as const, upserted: 0, deactivated: 0 };
    }
  }

  const seenIds = new Set<string>();
  let upserted = 0;

  for (const employee of employees) {
    seenIds.add(employee.id);
    if (await upsertCrmTechnicianFromEmployee(supabase, employee)) {
      upserted += 1;
    }
  }

  let deactivated = 0;
  if (seenIds.size) {
    const { data: stale, error: staleError } = await supabase
      .from("crm_technicians")
      .select("id, employee_id")
      .eq("active", true);

    if (!staleError && stale) {
      const staleIds = stale
        .filter((row) => !seenIds.has(String(row.employee_id)))
        .map((row) => String(row.id));
      if (staleIds.length) {
        const now = new Date().toISOString();
        const { error: deactivateError } = await supabase
          .from("crm_technicians")
          .update({ active: false, updated_at: now })
          .in("id", staleIds);
        if (!deactivateError) deactivated = staleIds.length;
      }
    }
  }

  console.log(`${LOG_PREFIX} synced`, { upserted, deactivated });
  return { ok: true as const, upserted, deactivated };
};

const selectTechnician = async (
  supabase: SupabaseClient,
  column: string,
  value: string,
) => {
  const { data, error } = await supabase
    .from("crm_technicians")
    .select("*")
    .eq(column, value)
    .maybeSingle();

  if (error) {
    if (!isMissingSchema(error)) {
      console.warn(`${LOG_PREFIX} select_failed`, {
        column,
        error: error.message,
      });
    }
    return null;
  }
  if (!data) return null;
  return fromTechnicianRow(data as Record<string, unknown>);
};

export const findCrmTechnician = async (
  supabase: SupabaseClient,
  input: { phone?: string | null; document?: string | null; id?: string | null },
): Promise<CrmTechnician | null> => {
  if (input.id) {
    const { data, error } = await supabase
      .from("crm_technicians")
      .select("*")
      .eq("id", input.id)
      .maybeSingle();
    if (!error && data) return fromTechnicianRow(data as Record<string, unknown>);
  }

  const last10 = phoneLast10(input.phone);
  if (last10) {
    const byWhatsapp = await selectTechnician(
      supabase,
      "whatsapp_phone_last10",
      last10,
    );
    if (byWhatsapp) return byWhatsapp;
    const byPhone = await selectTechnician(supabase, "phone_last10", last10);
    if (byPhone) return byPhone;
  }

  const secret = readHmacSecret();
  const digits = documentDigits(input.document);
  if (secret && digits) {
    const hash = hashTechnicianDocument(digits, secret);
    if (hash) {
      const byDocument = await selectTechnician(supabase, "document_hash", hash);
      if (byDocument) return byDocument;
    }
  }

  return null;
};

const loadConversationIdentity = async (
  supabase: SupabaseClient,
  conversationId: number,
) => {
  const { data, error } = await supabase
    .from("conversations")
    .select(
      "id, actor_type, technician_id, technician_employee_id, technician_verified_at, technician_verification_method, technician_report_offset",
    )
    .eq("id", conversationId)
    .maybeSingle();

  if (error) {
    if (!isMissingSchema(error)) {
      console.warn(`${LOG_PREFIX} conversation_identity_failed`, error.message);
    }
    return null;
  }
  return data as {
    actor_type?: string | null;
    technician_id?: string | null;
    technician_employee_id?: string | null;
    technician_verified_at?: string | null;
    technician_verification_method?: string | null;
    technician_report_offset?: number | null;
  } | null;
};

const persistConversationIdentity = async (
  supabase: SupabaseClient,
  input: {
    conversationId: number;
    technician: CrmTechnician;
    method: TechnicianVerificationMethod;
  },
) => {
  const now = new Date().toISOString();
  const { error } = await supabase
    .from("conversations")
    .update({
      actor_type: "technician",
      technician_id: input.technician.id,
      technician_employee_id: input.technician.employeeId,
      technician_verified_at: now,
      technician_verification_method: input.method,
      updated_at: now,
    })
    .eq("id", input.conversationId);

  if (error && !isMissingSchema(error)) {
    console.warn(`${LOG_PREFIX} persist_conversation_failed`, error.message);
  }
};

const bindTechnicianWhatsApp = async (
  supabase: SupabaseClient,
  input: {
    technician: CrmTechnician;
    phone: string | null;
    method: TechnicianVerificationMethod;
  },
): Promise<{ technician: CrmTechnician; conflict: boolean }> => {
  const last10 = phoneLast10(input.phone);
  if (!last10) return { technician: input.technician, conflict: false };
  const now = new Date().toISOString();
  const { data, error } = await supabase
    .from("crm_technicians")
    .update({
      whatsapp_phone_e164: toE164Digits(input.phone),
      whatsapp_phone_last10: last10,
      whatsapp_verified_at: now,
      whatsapp_verification_method: input.method,
      updated_at: now,
    })
    .eq("id", input.technician.id)
    .select("*")
    .maybeSingle();

  if (error) {
    if (error.code === "23505") {
      const owner = await selectTechnician(
        supabase,
        "whatsapp_phone_last10",
        last10,
      );
      if (owner && owner.id !== input.technician.id) {
        console.warn(`${LOG_PREFIX} whatsapp_already_bound`, {
          technicianId: input.technician.id,
          ownerId: owner.id,
        });
        return { technician: input.technician, conflict: true };
      }
    }
    if (!isMissingSchema(error)) {
      console.warn(`${LOG_PREFIX} bind_whatsapp_failed`, error.message);
    }
    return {
      technician: {
        ...input.technician,
        whatsappPhone: toE164Digits(input.phone),
        whatsappPhoneLast10: last10,
        whatsappVerifiedAt: now,
        whatsappVerificationMethod: input.method,
      },
      conflict: false,
    };
  }

  if (!data) return { technician: input.technician, conflict: false };
  return {
    technician: fromTechnicianRow(data as Record<string, unknown>),
    conflict: false,
  };
};

const findOpenChallenge = async (
  supabase: SupabaseClient,
  conversationId: number,
) => {
  const { data, error } = await supabase
    .from("crm_technician_challenges")
    .select("*")
    .eq("conversation_id", conversationId)
    .is("consumed_at", null)
    .gt("expires_at", new Date().toISOString())
    .order("created_at", { ascending: false })
    .limit(1)
    .maybeSingle();

  if (error) {
    if (!isMissingSchema(error)) {
      console.warn(`${LOG_PREFIX} challenge_read_failed`, error.message);
    }
    return null;
  }
  return data as {
    id: string;
    technician_id: string;
    code_hash: string;
    whatsapp_phone_last10: string;
  } | null;
};

const consumeChallenge = async (supabase: SupabaseClient, challengeId: string) => {
  await supabase
    .from("crm_technician_challenges")
    .update({ consumed_at: new Date().toISOString() })
    .eq("id", challengeId);
};

const countRecentChallenges = async (
  supabase: SupabaseClient,
  conversationId: number,
) => {
  const since = new Date(Date.now() - 60 * 60 * 1000).toISOString();
  const { count, error } = await supabase
    .from("crm_technician_challenges")
    .select("id", { count: "exact", head: true })
    .eq("conversation_id", conversationId)
    .gte("created_at", since);
  if (error) return 0;
  return count || 0;
};

const sendOtpChallenge = async (
  supabase: SupabaseClient,
  input: {
    conversationId: number;
    technician: CrmTechnician;
    inboundLast10: string | null;
  },
): Promise<TechnicianSession> => {
  const secret = readHmacSecret();
  const registeredPhone = input.technician.phone;
  if (!secret || !registeredPhone) {
    return {
      status: "need_registered_phone",
      technician: input.technician,
      employee: null,
      justVerified: false,
      method: null,
      message:
        "Reconocí tu cédula de técnico, pero tu ficha no tiene un WhatsApp registrado. Pide a coordinación que carguen tu número para enviarte los tickets.",
      reason: "technician_need_registered_phone",
      reportOffset: 0,
    };
  }

  const recent = await countRecentChallenges(supabase, input.conversationId);
  if (recent >= CHALLENGE_RATE_LIMIT) {
    return {
      status: "challenge_failed",
      technician: input.technician,
      employee: null,
      justVerified: false,
      method: null,
      message:
        "Demasiados intentos de verificación. Espera unos minutos o escribe desde el WhatsApp registrado en tu ficha.",
      reason: "technician_challenge_rate_limited",
      reportOffset: 0,
    };
  }

  await supabase
    .from("crm_technician_challenges")
    .update({ consumed_at: new Date().toISOString() })
    .eq("conversation_id", input.conversationId)
    .is("consumed_at", null);

  const code = generateTechnicianOtp();
  const { error } = await supabase.from("crm_technician_challenges").insert({
    technician_id: input.technician.id,
    conversation_id: input.conversationId,
    whatsapp_phone_last10: input.inboundLast10,
    code_hash: hashTechnicianOtp({
      technicianId: input.technician.id,
      conversationId: input.conversationId,
      code,
      secret,
    }),
    expires_at: new Date(Date.now() + OTP_TTL_MS).toISOString(),
  });

  if (error) {
    if (!isMissingSchema(error)) {
      console.warn(`${LOG_PREFIX} challenge_insert_failed`, error.message);
    }
    return {
      status: "need_registered_phone",
      technician: input.technician,
      employee: null,
      justVerified: false,
      method: null,
      message:
        "No pude generar el código de verificación. Escribe desde el WhatsApp registrado en tu ficha o avisa a coordinación.",
      reason: "technician_challenge_insert_failed",
      reportOffset: 0,
    };
  }

  try {
    await sendWhatsAppText({
      to: registeredPhone,
      body: `Innover: código de verificación para vincular un WhatsApp a tu usuario de técnico: ${code}. Vence en 10 minutos. Si no fuiste tú, ignóralo.`,
      supabase,
      conversationId: input.conversationId,
      persist: false,
      metadata: { engine: "ai", action: "technician_otp" },
    });
  } catch (error) {
    console.warn(`${LOG_PREFIX} otp_send_failed`, error);
    return {
      status: "challenge_failed",
      technician: input.technician,
      employee: null,
      justVerified: false,
      method: null,
      message:
        "No pude enviar el código al WhatsApp registrado. Escribe desde ese número o pide a coordinación que revisen tu ficha.",
      reason: "technician_otp_send_failed",
      reportOffset: 0,
    };
  }

  await recordTechnicianEvent(supabase, {
    technicianId: input.technician.id,
    conversationId: input.conversationId,
    event: "challenge_sent",
    method: "otp",
    metadata: { phone_last10: input.inboundLast10 },
  });

  return {
    status: "challenge_sent",
    technician: input.technician,
    employee: null,
    justVerified: false,
    method: null,
    message:
      "Para proteger tus tickets, te envié un código al WhatsApp registrado en tu ficha. Respóndelo aquí (solo números).",
    reason: "technician_challenge_sent",
    reportOffset: 0,
  };
};

const verifiedSession = async (
  supabase: SupabaseClient,
  input: {
    conversationId: number;
    technician: CrmTechnician;
    method: TechnicianVerificationMethod;
    phone: string | null;
    justVerified: boolean;
    reportOffset: number;
  },
): Promise<TechnicianSession> => {
  const bound = await bindTechnicianWhatsApp(supabase, {
    technician: input.technician,
    phone: input.phone,
    method: input.method,
  });
  if (bound.conflict) {
    await recordTechnicianEvent(supabase, {
      technicianId: input.technician.id,
      conversationId: input.conversationId,
      event: "whatsapp_conflict",
      method: input.method,
    });
    return {
      status: "challenge_failed",
      technician: input.technician,
      employee: null,
      justVerified: false,
      method: null,
      message:
        "Este WhatsApp ya está vinculado a otro técnico. Escribe desde tu número registrado o avisa a coordinación.",
      reason: "technician_whatsapp_conflict",
      reportOffset: input.reportOffset,
    };
  }

  await persistConversationIdentity(supabase, {
    conversationId: input.conversationId,
    technician: bound.technician,
    method: input.method,
  });
  if (input.justVerified) {
    await recordTechnicianEvent(supabase, {
      technicianId: bound.technician.id,
      conversationId: input.conversationId,
      event: "verified",
      method: input.method,
    });
  }

  return {
    status: "verified",
    technician: bound.technician,
    employee: toMatchedEmployee(bound.technician),
    justVerified: input.justVerified,
    method: input.method,
    message: input.justVerified
      ? `Hola ${technicianFirstName(bound.technician.name)}. Te identificamos como técnico.`
      : null,
    reason: `technician_verified:${input.method}`,
    reportOffset: input.reportOffset,
  };
};

export const resolveTechnicianSession = async (
  supabase: SupabaseClient,
  input: TechnicianInboundInput,
): Promise<TechnicianSession> => {
  const inboundLast10 = phoneLast10(input.phone);
  const inboundText = String(input.text || "");
  const paymentOverride = Boolean(input.paymentOverride);
  const conversation = await loadConversationIdentity(
    supabase,
    input.conversationId,
  );
  const reportOffset = Number(conversation?.technician_report_offset || 0);
  const conversationIsTechnician =
    conversation?.actor_type === "technician" &&
    Boolean(conversation.technician_id);

  let technician = conversation?.technician_id
    ? await findCrmTechnician(supabase, { id: conversation.technician_id })
    : null;

  const openChallenge = await findOpenChallenge(supabase, input.conversationId);
  const otpDigits = looksLikeOtpCode(inboundText)
    ? inboundText.replace(/\D/g, "")
    : input.otp?.replace(/\D/g, "") || null;
  const secret = readHmacSecret();

  let otpValid = false;
  if (openChallenge && otpDigits && secret) {
    const expected = hashTechnicianOtp({
      technicianId: openChallenge.technician_id,
      conversationId: input.conversationId,
      code: otpDigits,
      secret,
    });
    otpValid = secretsEqual(expected, openChallenge.code_hash);
    if (otpValid) {
      await consumeChallenge(supabase, openChallenge.id);
      technician =
        (await findCrmTechnician(supabase, { id: openChallenge.technician_id })) ||
        technician;
    } else if (otpDigits.length === 6) {
      await recordTechnicianEvent(supabase, {
        technicianId: openChallenge.technician_id,
        conversationId: input.conversationId,
        event: "challenge_failed",
        method: "otp",
      });
      return {
        status: "challenge_failed",
        technician,
        employee: null,
        justVerified: false,
        method: null,
        message:
          "El código no es válido o ya venció. Envía tu cédula otra vez para generar uno nuevo.",
        reason: "technician_challenge_failed",
        reportOffset,
      };
    }
  }

  const cedula =
    openChallenge && otpDigits && documentDigits(input.cedula) === otpDigits
      ? null
      : input.cedula;

  if (!technician) {
    technician = await findCrmTechnician(supabase, {
      phone: input.phone,
      document: cedula,
    });
  }

  if (!technician && (inboundLast10 || documentDigits(cedula))) {
    await syncCrmTechnicians(supabase);
    technician = await findCrmTechnician(supabase, {
      phone: input.phone,
      document: cedula,
      id: conversation?.technician_id,
    });
  }

  const byDocument = documentDigits(cedula)
    ? await findCrmTechnician(supabase, { document: cedula })
    : null;
  if (!technician && byDocument) technician = byDocument;

  const hasDocumentMatch = Boolean(
    technician && byDocument && technician.id === byDocument.id,
  );

  const decision = decideTechnicianVerification({
    technician: technician ? toIdentityRow(technician) : null,
    inboundLast10,
    hasDocumentMatch,
    claimsTechnicianRole: Boolean(input.claimsTechnicianRole),
    conversationIsTechnician,
    otpValid,
    paymentOverride,
  });

  if (decision.action === "customer") {
    return emptyCustomerSession("customer");
  }

  if (!technician || decision.action === "inactive") {
    return {
      status: "inactive",
      technician,
      employee: null,
      justVerified: false,
      method: null,
      message:
        "Tu usuario de técnico no está activo. Comunícate con coordinación.",
      reason: "technician_inactive",
      reportOffset,
    };
  }

  if (decision.action === "need_registered_phone") {
    await recordTechnicianEvent(supabase, {
      technicianId: technician.id,
      conversationId: input.conversationId,
      event: "need_registered_phone",
      method: "document",
    });
    return {
      status: "need_registered_phone",
      technician,
      employee: null,
      justVerified: false,
      method: null,
      message:
        "Reconocí tu cédula de técnico, pero tu ficha no tiene un WhatsApp registrado. Pide a coordinación que carguen tu número para enviarte los tickets.",
      reason: "technician_need_registered_phone",
      reportOffset,
    };
  }

  if (decision.action === "need_otp") {
    return sendOtpChallenge(supabase, {
      conversationId: input.conversationId,
      technician,
      inboundLast10,
    });
  }

  const alreadyVerified = Boolean(
    conversationIsTechnician &&
      conversation?.technician_id === technician.id &&
      conversation.technician_verified_at,
  );

  return verifiedSession(supabase, {
    conversationId: input.conversationId,
    technician,
    method: decision.method,
    phone: input.phone || null,
    justVerified: !alreadyVerified || otpValid,
    reportOffset,
  });
};

export const updateTechnicianReportOffset = async (
  supabase: SupabaseClient,
  conversationId: number,
  offset: number,
) => {
  const { error } = await supabase
    .from("conversations")
    .update({
      technician_report_offset: Math.max(0, offset),
      updated_at: new Date().toISOString(),
    })
    .eq("id", conversationId);
  if (error && !isMissingSchema(error)) {
    console.warn(`${LOG_PREFIX} offset_update_failed`, error.message);
  }
};
