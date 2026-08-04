import type { SupabaseClient } from "@supabase/supabase-js";

export type CrmAutoLabelKey = "verificar_pago" | "soporte";

const LOG_PREFIX = "[CRM_LABELS]";

const LABEL_ENV_KEYS: Record<CrmAutoLabelKey, string> = {
  verificar_pago: "CRM_LABEL_VERIFICAR_PAGO_ID",
  soporte: "CRM_LABEL_SOPORTE_ID",
};

/** Name fallbacks when env ID is not set (matched case-insensitive). */
const LABEL_NAME_CANDIDATES: Record<CrmAutoLabelKey, string[]> = {
  verificar_pago: ["verificar pago", "verificar_pago", "verificacion de pago"],
  soporte: ["soporte", "soporte tecnico", "soporte técnico", "falla tecnica"],
};

const normalizeLabelName = (value: string) =>
  value
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .trim()
    .toLowerCase()
    .replace(/\s+/g, " ");

const parseLabelId = (raw: string | undefined): number | null => {
  if (!raw?.trim()) return null;
  const parsed = Number.parseInt(raw.trim(), 10);
  return Number.isFinite(parsed) && parsed > 0 ? parsed : null;
};

const resolveLabelIdFromEnv = (key: CrmAutoLabelKey): number | null =>
  parseLabelId(process.env[LABEL_ENV_KEYS[key]]);

const resolveLabelIdByName = async (
  supabase: SupabaseClient,
  key: CrmAutoLabelKey,
): Promise<number | null> => {
  const { data, error } = await supabase
    .from("labels")
    .select("id, name")
    .order("id", { ascending: true });

  if (error) {
    console.warn(`${LOG_PREFIX} labels_query_failed`, {
      key,
      error: error.message,
    });
    return null;
  }

  const candidates = new Set(
    LABEL_NAME_CANDIDATES[key].map((name) => normalizeLabelName(name)),
  );

  const match = (data || []).find((label) =>
    candidates.has(normalizeLabelName(String(label.name || ""))),
  );

  return match?.id ?? null;
};

export const resolveAutoLabelId = async (
  supabase: SupabaseClient,
  key: CrmAutoLabelKey,
): Promise<number | null> => {
  const fromEnv = resolveLabelIdFromEnv(key);
  if (fromEnv) return fromEnv;
  return resolveLabelIdByName(supabase, key);
};

/**
 * Appends a label to conversation.label_ids without duplicates.
 * Soft-fails (logs) if the label cannot be resolved or the update fails.
 */
export const ensureConversationLabel = async (
  supabase: SupabaseClient,
  conversationId: number,
  key: CrmAutoLabelKey,
): Promise<{ applied: boolean; labelId: number | null }> => {
  const labelId = await resolveAutoLabelId(supabase, key);
  if (!labelId) {
    console.warn(`${LOG_PREFIX} label_not_resolved`, {
      conversationId,
      key,
      hint: `Define ${LABEL_ENV_KEYS[key]} o crea la etiqueta con nombre canónico`,
    });
    return { applied: false, labelId: null };
  }

  const { data: conversation, error: readError } = await supabase
    .from("conversations")
    .select("id, label_ids")
    .eq("id", conversationId)
    .maybeSingle();

  if (readError || !conversation) {
    console.warn(`${LOG_PREFIX} conversation_read_failed`, {
      conversationId,
      key,
      labelId,
      error: readError?.message || "not_found",
    });
    return { applied: false, labelId };
  }

  const currentIds = Array.isArray(conversation.label_ids)
    ? conversation.label_ids
        .map((value) => Number(value))
        .filter((value) => Number.isFinite(value) && value > 0)
    : [];

  if (currentIds.includes(labelId)) {
    return { applied: true, labelId };
  }

  const nextIds = [...currentIds, labelId];
  const { error: updateError } = await supabase
    .from("conversations")
    .update({
      label_ids: nextIds,
      updated_at: new Date().toISOString(),
    })
    .eq("id", conversationId);

  if (updateError) {
    console.warn(`${LOG_PREFIX} label_apply_failed`, {
      conversationId,
      key,
      labelId,
      error: updateError.message,
    });
    return { applied: false, labelId };
  }

  console.log(`${LOG_PREFIX} label_applied`, {
    conversationId,
    key,
    labelId,
    labelIds: nextIds,
  });

  return { applied: true, labelId };
};
