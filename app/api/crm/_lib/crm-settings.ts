import type { SupabaseClient } from "@supabase/supabase-js";
import {
  DEFAULT_BOT_ENGINE,
  normalizeBotEngine,
  type BotEngine,
} from "./bot-engine";
import {
  DEFAULT_AFTER_HOURS_PAYMENTS,
  DEFAULT_OFFICE_HOURS,
  parseAfterHoursPaymentsConfig,
  parseOfficeHoursConfig,
  resolveOfficeHoursFromEnv,
  type AfterHoursPaymentsConfig,
  type OfficeHoursConfig,
} from "./office-hours";

export type CrmSettings = {
  id: number;
  bot_engine: BotEngine;
  gemini_model: string;
  ai_system_prompt: string | null;
  office_hours: OfficeHoursConfig;
  after_hours_payments: AfterHoursPaymentsConfig;
  updated_at: string | null;
  updated_by: number | null;
};

const DEFAULT_GEMINI_MODEL = "gemini-2.0-flash";

const DEFAULT_SETTINGS: CrmSettings = {
  id: 1,
  bot_engine: DEFAULT_BOT_ENGINE,
  gemini_model: DEFAULT_GEMINI_MODEL,
  ai_system_prompt: null,
  office_hours: DEFAULT_OFFICE_HOURS,
  after_hours_payments: DEFAULT_AFTER_HOURS_PAYMENTS,
  updated_at: null,
  updated_by: null,
};

const mapSettingsRow = (row: Record<string, unknown> | null): CrmSettings => {
  if (!row) {
    return {
      ...DEFAULT_SETTINGS,
      office_hours: resolveOfficeHoursFromEnv(),
    };
  }

  const officeFromDb =
    row.office_hours !== undefined && row.office_hours !== null
      ? parseOfficeHoursConfig(row.office_hours)
      : resolveOfficeHoursFromEnv();

  const afterHoursFromDb =
    row.after_hours_payments !== undefined && row.after_hours_payments !== null
      ? parseAfterHoursPaymentsConfig(row.after_hours_payments)
      : DEFAULT_AFTER_HOURS_PAYMENTS;

  return {
    id: Number(row.id) || 1,
    bot_engine: normalizeBotEngine(row.bot_engine),
    gemini_model:
      typeof row.gemini_model === "string" && row.gemini_model.trim()
        ? row.gemini_model.trim()
        : DEFAULT_GEMINI_MODEL,
    ai_system_prompt:
      typeof row.ai_system_prompt === "string" ? row.ai_system_prompt : null,
    office_hours: officeFromDb,
    after_hours_payments: afterHoursFromDb,
    updated_at:
      typeof row.updated_at === "string" ? row.updated_at : null,
    updated_by:
      typeof row.updated_by === "number"
        ? row.updated_by
        : row.updated_by
          ? Number(row.updated_by)
          : null,
  };
};

export const getCrmSettings = async (
  supabase: SupabaseClient,
): Promise<CrmSettings> => {
  const { data, error } = await supabase
    .from("crm_settings")
    .select("*")
    .eq("id", 1)
    .maybeSingle();

  if (error) {
    // Table may not exist yet before migration; fail soft to Gemini defaults.
    console.error("[crm_settings] load_failed", error.message);
    return {
      ...DEFAULT_SETTINGS,
      office_hours: resolveOfficeHoursFromEnv(),
    };
  }

  if (!data) {
    const { data: inserted, error: insertError } = await supabase
      .from("crm_settings")
      .upsert(
        {
          id: 1,
          bot_engine: DEFAULT_BOT_ENGINE,
          gemini_model: DEFAULT_GEMINI_MODEL,
          updated_at: new Date().toISOString(),
        },
        { onConflict: "id" },
      )
      .select("*")
      .single();

    if (insertError) {
      console.error("[crm_settings] seed_failed", insertError.message);
      return DEFAULT_SETTINGS;
    }

    return mapSettingsRow(inserted as Record<string, unknown>);
  }

  return mapSettingsRow(data as Record<string, unknown>);
};

export const updateCrmSettings = async (
  supabase: SupabaseClient,
  payload: {
    bot_engine?: BotEngine;
    gemini_model?: string;
    ai_system_prompt?: string | null;
    office_hours?: OfficeHoursConfig;
    after_hours_payments?: AfterHoursPaymentsConfig;
    updated_by?: number | null;
  },
): Promise<CrmSettings> => {
  const current = await getCrmSettings(supabase);
  const nextOfficeHours = payload.office_hours
    ? parseOfficeHoursConfig(payload.office_hours)
    : current.office_hours;
  const nextAfterHours = payload.after_hours_payments
    ? parseAfterHoursPaymentsConfig(payload.after_hours_payments)
    : current.after_hours_payments;

  const next = {
    id: 1,
    bot_engine: payload.bot_engine ?? current.bot_engine,
    gemini_model: payload.gemini_model?.trim() || current.gemini_model,
    ai_system_prompt:
      payload.ai_system_prompt === undefined
        ? current.ai_system_prompt
        : payload.ai_system_prompt,
    office_hours: nextOfficeHours,
    after_hours_payments: nextAfterHours,
    updated_at: new Date().toISOString(),
    updated_by:
      payload.updated_by === undefined
        ? current.updated_by
        : payload.updated_by,
  };

  const { data, error } = await supabase
    .from("crm_settings")
    .upsert(next, { onConflict: "id" })
    .select("*")
    .single();

  if (error) {
    // Soft message if migration not applied yet.
    if (
      /office_hours|after_hours_payments|column/i.test(error.message || "")
    ) {
      throw new Error(
        "Falta la migración de horarios en Supabase (office_hours / after_hours_payments). Ejecuta supabase/migrations/20260817140000_crm_settings_office_hours.sql",
      );
    }
    throw error;
  }

  return mapSettingsRow(data as Record<string, unknown>);
};
