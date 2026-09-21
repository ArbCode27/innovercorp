import type { SupabaseClient } from "@supabase/supabase-js";
import { digitsOnly, phoneLast10 } from "./phone-match";

export const SUPERVISOR_CACHE_TTL_MS = 60 * 1000;

export type CrmSupervisor = {
  id: string;
  name: string;
  phoneLast10: string;
  wisproEmployeeId: string | null;
  active: boolean;
  createdBy: number | null;
  createdAt: string;
  updatedAt: string;
};

export type UpsertSupervisorInput = {
  id?: string;
  name: string;
  phone: string;
  wisproEmployeeId?: string | null;
  active?: boolean;
};

/**
 * Normalizes phone number on the server:
 * Must contain at least 10 digits.
 * Extracts the last 10 digits (e.g. 04142132785 -> 4142132785, +584142132785 -> 4142132785).
 * Returns null if fewer than 10 digits.
 */
export const normalizeSupervisorPhoneLast10 = (
  value: string | null | undefined,
): string | null => {
  const digits = digitsOnly(value);
  if (digits.length < 10) return null;
  return digits.slice(-10);
};

type SupervisorCache = {
  expiresAt: number;
  byPhoneLast10: Map<string, CrmSupervisor>;
};

let activeSupervisorCache: SupervisorCache | null = null;

export const invalidateSupervisorCache = () => {
  activeSupervisorCache = null;
};

const fromSupervisorRow = (row: Record<string, unknown>): CrmSupervisor => ({
  id: String(row.id),
  name: String(row.name || "Gerente"),
  phoneLast10: String(row.phone_last10 || ""),
  wisproEmployeeId: (row.wispro_employee_id as string | null) ?? null,
  active: row.active !== false,
  createdBy: row.created_by == null ? null : Number(row.created_by),
  createdAt: String(row.created_at || ""),
  updatedAt: String(row.updated_at || ""),
});

/**
 * Lists all active supervisors with in-memory caching (TTL <= 60s).
 */
export const listActiveSupervisors = async (
  supabase: SupabaseClient,
  options?: { forceRefresh?: boolean },
): Promise<CrmSupervisor[]> => {
  if (
    !options?.forceRefresh &&
    activeSupervisorCache &&
    activeSupervisorCache.expiresAt > Date.now()
  ) {
    return [...activeSupervisorCache.byPhoneLast10.values()];
  }

  const { data, error } = await supabase
    .from("crm_supervisors")
    .select("*")
    .eq("active", true);

  if (error) {
    console.warn("[SUPERVISORS] list_active_failed", error.message);
    return [];
  }

  const byPhoneLast10 = new Map<string, CrmSupervisor>();
  for (const row of data || []) {
    const supervisor = fromSupervisorRow(row as Record<string, unknown>);
    if (supervisor.phoneLast10) {
      byPhoneLast10.set(supervisor.phoneLast10, supervisor);
    }
  }

  activeSupervisorCache = {
    expiresAt: Date.now() + SUPERVISOR_CACHE_TTL_MS,
    byPhoneLast10,
  };

  return [...byPhoneLast10.values()];
};

/**
 * Finds an active supervisor matching the last 10 digits of the given phone number.
 * Uses 60-second in-memory cache.
 */
export const findActiveSupervisorByPhone = async (
  supabase: SupabaseClient,
  phone: string | null | undefined,
): Promise<CrmSupervisor | null> => {
  const last10 = phoneLast10(phone);
  if (!last10) return null;

  if (
    activeSupervisorCache &&
    activeSupervisorCache.expiresAt > Date.now()
  ) {
    return activeSupervisorCache.byPhoneLast10.get(last10) || null;
  }

  const active = await listActiveSupervisors(supabase);
  return active.find((supervisor) => supervisor.phoneLast10 === last10) || null;
};

/**
 * Lists all supervisors (active and inactive) for admin management.
 */
export const listAllSupervisors = async (
  supabase: SupabaseClient,
): Promise<CrmSupervisor[]> => {
  const { data, error } = await supabase
    .from("crm_supervisors")
    .select("*")
    .order("created_at", { ascending: false });

  if (error) {
    throw new Error(error.message || "No se pudieron cargar los gerentes");
  }

  return (data || []).map((row) =>
    fromSupervisorRow(row as Record<string, unknown>),
  );
};

/**
 * Creates or updates a supervisor. Validates uniqueness among active records.
 */
export const upsertSupervisor = async (
  supabase: SupabaseClient,
  input: UpsertSupervisorInput,
  agentId?: number | null,
): Promise<CrmSupervisor> => {
  const phoneLast10 = normalizeSupervisorPhoneLast10(input.phone);
  if (!phoneLast10) {
    throw new Error("El teléfono debe contener al menos 10 dígitos");
  }

  const normalizedName = input.name.trim();
  if (!normalizedName) {
    throw new Error("El nombre del gerente es requerido");
  }

  const isActive = input.active !== false;

  // Check unique active phone constraint before write
  if (isActive) {
    const existingActive = await supabase
      .from("crm_supervisors")
      .select("id, name")
      .eq("phone_last10", phoneLast10)
      .eq("active", true)
      .maybeSingle();

    if (
      existingActive.data &&
      (!input.id || existingActive.data.id !== input.id)
    ) {
      throw new Error(
        `Ya existe un gerente activo (${existingActive.data.name}) con este número de WhatsApp.`,
      );
    }
  }

  const now = new Date().toISOString();

  if (input.id) {
    const { data, error } = await supabase
      .from("crm_supervisors")
      .update({
        name: normalizedName,
        phone_last10: phoneLast10,
        wispro_employee_id: input.wisproEmployeeId?.trim() || null,
        active: isActive,
        updated_at: now,
      })
      .eq("id", input.id)
      .select("*")
      .single();

    if (error) {
      if (error.code === "23505") {
        throw new Error(
          "Ya existe un gerente activo con este número de WhatsApp.",
        );
      }
      throw new Error(error.message || "No se pudo actualizar el gerente");
    }

    invalidateSupervisorCache();
    return fromSupervisorRow(data as Record<string, unknown>);
  }

  const { data, error } = await supabase
    .from("crm_supervisors")
    .insert({
      name: normalizedName,
      phone_last10: phoneLast10,
      wispro_employee_id: input.wisproEmployeeId?.trim() || null,
      active: isActive,
      created_by: agentId ?? null,
      created_at: now,
      updated_at: now,
    })
    .select("*")
    .single();

  if (error) {
    if (error.code === "23505") {
      throw new Error(
        "Ya existe un gerente activo con este número de WhatsApp.",
      );
    }
    throw new Error(error.message || "No se pudo crear el gerente");
  }

  invalidateSupervisorCache();
  return fromSupervisorRow(data as Record<string, unknown>);
};

/**
 * Toggles supervisor active status (logical delete/restore).
 */
export const toggleSupervisorStatus = async (
  supabase: SupabaseClient,
  supervisorId: string,
  active: boolean,
): Promise<CrmSupervisor> => {
  if (active) {
    // If activating, verify no other active supervisor has this phone
    const { data: current } = await supabase
      .from("crm_supervisors")
      .select("phone_last10")
      .eq("id", supervisorId)
      .maybeSingle();

    if (current?.phone_last10) {
      const existing = await supabase
        .from("crm_supervisors")
        .select("id, name")
        .eq("phone_last10", current.phone_last10)
        .eq("active", true)
        .neq("id", supervisorId)
        .maybeSingle();

      if (existing.data) {
        throw new Error(
          `No se puede activar: ya existe otro gerente activo (${existing.data.name}) con este teléfono.`,
        );
      }
    }
  }

  const now = new Date().toISOString();
  const { data, error } = await supabase
    .from("crm_supervisors")
    .update({
      active,
      updated_at: now,
    })
    .eq("id", supervisorId)
    .select("*")
    .single();

  if (error) {
    if (error.code === "23505") {
      throw new Error(
        "Ya existe un gerente activo con este número de WhatsApp.",
      );
    }
    throw new Error(error.message || "No se pudo cambiar el estado del gerente");
  }

  invalidateSupervisorCache();
  return fromSupervisorRow(data as Record<string, unknown>);
};
