import type { SupabaseClient } from "@supabase/supabase-js";
import { documentDigits, phoneLast10 } from "./phone-match";
import type { CrmWisproCaso, CrmWisproCasoStatus } from "./wispro-types";

export type UpsertCrmWisproCasoInput = {
  conversationId?: number | null;
  crmClientId?: number | null;
  wisproClientId?: string | null;
  wisproIssueId: string;
  wisproPublicId?: number | null;
  wisproOrderId?: string | null;
  employeeId?: string | null;
  employeeName?: string | null;
  employeePhone?: string | null;
  employeeDocument?: string | null;
  status: CrmWisproCasoStatus;
  kind?: string | null;
  title: string;
  cause?: string | null;
  description?: string | null;
  clientName?: string | null;
  clientPhone?: string | null;
  mapsUrl?: string | null;
  latitude?: number | null;
  longitude?: number | null;
  addressText?: string | null;
  facadeMediaUrl?: string | null;
  facadeMessageId?: number | null;
  windowStart?: string | null;
  windowEnd?: string | null;
};

const OPEN_STATUSES: CrmWisproCasoStatus[] = ["open", "scheduled"];

const toRow = (input: UpsertCrmWisproCasoInput) => ({
  conversation_id: input.conversationId ?? null,
  crm_client_id: input.crmClientId ?? null,
  wispro_client_id: input.wisproClientId ?? null,
  wispro_issue_id: input.wisproIssueId,
  wispro_public_id: input.wisproPublicId ?? null,
  wispro_order_id: input.wisproOrderId ?? null,
  employee_id: input.employeeId ?? null,
  employee_name: input.employeeName ?? null,
  employee_phone: input.employeePhone ?? null,
  employee_phone_last10: phoneLast10(input.employeePhone),
  employee_document: input.employeeDocument ?? null,
  employee_document_digits: documentDigits(input.employeeDocument),
  status: input.status,
  kind: input.kind ?? null,
  title: input.title,
  cause: input.cause ?? null,
  description: input.description ?? null,
  client_name: input.clientName ?? null,
  client_phone: input.clientPhone ?? null,
  maps_url: input.mapsUrl ?? null,
  latitude: input.latitude ?? null,
  longitude: input.longitude ?? null,
  address_text: input.addressText ?? null,
  facade_media_url: input.facadeMediaUrl ?? null,
  facade_message_id: input.facadeMessageId ?? null,
  window_start: input.windowStart ?? null,
  window_end: input.windowEnd ?? null,
  updated_at: new Date().toISOString(),
});

const fromRow = (row: Record<string, unknown>): CrmWisproCaso => ({
  id: String(row.id),
  conversationId: row.conversation_id == null ? null : Number(row.conversation_id),
  crmClientId: row.crm_client_id == null ? null : Number(row.crm_client_id),
  wisproClientId: (row.wispro_client_id as string | null) ?? null,
  wisproIssueId: String(row.wispro_issue_id),
  wisproPublicId:
    row.wispro_public_id == null ? null : Number(row.wispro_public_id),
  wisproOrderId: (row.wispro_order_id as string | null) ?? null,
  employeeId: (row.employee_id as string | null) ?? null,
  employeeName: (row.employee_name as string | null) ?? null,
  employeePhone: (row.employee_phone as string | null) ?? null,
  employeeDocument: (row.employee_document as string | null) ?? null,
  status: String(row.status) as CrmWisproCasoStatus,
  kind: (row.kind as string | null) ?? null,
  title: String(row.title || ""),
  cause: (row.cause as string | null) ?? null,
  description: (row.description as string | null) ?? null,
  clientName: (row.client_name as string | null) ?? null,
  clientPhone: (row.client_phone as string | null) ?? null,
  mapsUrl: (row.maps_url as string | null) ?? null,
  latitude: row.latitude == null ? null : Number(row.latitude),
  longitude: row.longitude == null ? null : Number(row.longitude),
  addressText: (row.address_text as string | null) ?? null,
  facadeMediaUrl: (row.facade_media_url as string | null) ?? null,
  facadeMessageId:
    row.facade_message_id == null ? null : Number(row.facade_message_id),
  hasFacade: Boolean(row.facade_media_url),
  windowStart: (row.window_start as string | null) ?? null,
  windowEnd: (row.window_end as string | null) ?? null,
  lastTechnicianReportAt: (row.last_technician_report_at as string | null) ?? null,
  lastTechnicianReportKey: (row.last_technician_report_key as string | null) ?? null,
  createdAt: (row.created_at as string | null) ?? null,
  updatedAt: (row.updated_at as string | null) ?? null,
});

export const getCrmWisproCasoByIssueId = async (
  supabase: SupabaseClient,
  wisproIssueId: string,
) => {
  const { data, error } = await supabase
    .from("crm_wispro_casos")
    .select("*")
    .eq("wispro_issue_id", wisproIssueId)
    .maybeSingle();

  if (error) {
    throw new Error(error.message || "No se pudo leer la ficha del ticket");
  }
  if (!data) return null;
  return fromRow(data as Record<string, unknown>);
};

export const upsertCrmWisproCaso = async (
  supabase: SupabaseClient,
  input: UpsertCrmWisproCasoInput,
) => {
  const { data, error } = await supabase
    .from("crm_wispro_casos")
    .upsert(toRow(input), { onConflict: "wispro_issue_id" })
    .select("*")
    .single();

  if (error) {
    throw new Error(error.message || "No se pudo guardar la ficha del caso");
  }

  return fromRow(data as Record<string, unknown>);
};

export const toUpsertCrmWisproCasoInput = (
  caso: CrmWisproCaso,
): UpsertCrmWisproCasoInput => ({
  conversationId: caso.conversationId,
  crmClientId: caso.crmClientId,
  wisproClientId: caso.wisproClientId,
  wisproIssueId: caso.wisproIssueId,
  wisproPublicId: caso.wisproPublicId,
  wisproOrderId: caso.wisproOrderId,
  employeeId: caso.employeeId,
  employeeName: caso.employeeName,
  employeePhone: caso.employeePhone,
  employeeDocument: caso.employeeDocument,
  status: caso.status,
  kind: caso.kind,
  title: caso.title,
  cause: caso.cause,
  description: caso.description,
  clientName: caso.clientName,
  clientPhone: caso.clientPhone,
  mapsUrl: caso.mapsUrl,
  latitude: caso.latitude,
  longitude: caso.longitude,
  addressText: caso.addressText,
  facadeMediaUrl: caso.facadeMediaUrl,
  facadeMessageId: caso.facadeMessageId,
  windowStart: caso.windowStart,
  windowEnd: caso.windowEnd,
});

export const patchCrmWisproCaso = async (
  supabase: SupabaseClient,
  wisproIssueId: string,
  patch: Partial<UpsertCrmWisproCasoInput>,
) => {
  const existing = await getCrmWisproCasoByIssueId(supabase, wisproIssueId);
  if (!existing) {
    throw new Error("No existe la ficha CRM de este ticket");
  }
  return upsertCrmWisproCaso(supabase, {
    ...toUpsertCrmWisproCasoInput(existing),
    ...patch,
    wisproIssueId,
  });
};

export const listCrmWisproCasos = async (
  supabase: SupabaseClient,
  input?: { status?: CrmWisproCasoStatus[] },
) => {
  let query = supabase
    .from("crm_wispro_casos")
    .select("*")
    .order("created_at", { ascending: false })
    .limit(200);

  if (input?.status?.length) {
    query = query.in("status", input.status);
  }

  const { data, error } = await query;
  if (error) {
    throw new Error(error.message || "No se pudieron listar los casos");
  }

  return (data || []).map((row) => fromRow(row as Record<string, unknown>));
};

export const listOpenCasosForConversation = async (
  supabase: SupabaseClient,
  input: {
    conversationId: number;
    crmClientId?: number | null;
    wisproClientId?: string | null;
  },
) => {
  const filters = [`conversation_id.eq.${input.conversationId}`];
  if (input.crmClientId) {
    filters.push(`crm_client_id.eq.${input.crmClientId}`);
  }
  if (input.wisproClientId) {
    filters.push(`wispro_client_id.eq.${input.wisproClientId}`);
  }

  const { data, error } = await supabase
    .from("crm_wispro_casos")
    .select("*")
    .in("status", OPEN_STATUSES)
    .or(filters.join(","))
    .order("created_at", { ascending: false })
    .limit(10);

  if (error) {
    throw new Error(error.message || "No se pudieron leer los tickets del chat");
  }

  return (data || []).map((row) => fromRow(row as Record<string, unknown>));
};

export const listPendingCasosForEmployee = async (
  supabase: SupabaseClient,
  employeeId: string,
) => {
  const { data, error } = await supabase
    .from("crm_wispro_casos")
    .select("*")
    .eq("employee_id", employeeId)
    .in("status", OPEN_STATUSES)
    .order("window_start", { ascending: true, nullsFirst: false })
    .limit(20);

  if (error) {
    throw new Error(error.message || "No se pudieron leer los tickets del técnico");
  }

  return (data || []).map((row) => fromRow(row as Record<string, unknown>));
};

export const findEmployeeIdByPhoneLast10 = async (
  supabase: SupabaseClient,
  last10: string | null,
) => {
  if (!last10) return null;
  const { data, error } = await supabase
    .from("crm_wispro_casos")
    .select("employee_id, employee_name, employee_phone, employee_document")
    .eq("employee_phone_last10", last10)
    .not("employee_id", "is", null)
    .order("updated_at", { ascending: false })
    .limit(1)
    .maybeSingle();

  if (error || !data?.employee_id) return null;
  return {
    id: String(data.employee_id),
    name: data.employee_name ? String(data.employee_name) : "Técnico",
    phone: data.employee_phone ? String(data.employee_phone) : null,
    document: data.employee_document ? String(data.employee_document) : null,
  };
};

export const findEmployeeByDocumentDigits = async (
  supabase: SupabaseClient,
  digits: string | null,
) => {
  if (!digits) return null;
  const { data, error } = await supabase
    .from("crm_wispro_casos")
    .select("employee_id, employee_name, employee_phone, employee_document")
    .eq("employee_document_digits", digits)
    .not("employee_id", "is", null)
    .order("updated_at", { ascending: false })
    .limit(1)
    .maybeSingle();

  if (error || !data?.employee_id) return null;
  return {
    id: String(data.employee_id),
    name: data.employee_name ? String(data.employee_name) : "Técnico",
    phone: data.employee_phone ? String(data.employee_phone) : null,
    document: data.employee_document ? String(data.employee_document) : digits,
  };
};
