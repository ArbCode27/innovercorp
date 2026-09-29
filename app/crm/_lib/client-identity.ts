import type { SupabaseClient } from "@supabase/supabase-js";
import { digitsOnly, phoneLast10, phonesMatch } from "@/lib/phone-match";
import type { Client } from "./types";

const LOG_PREFIX = "[CLIENT_IDENTITY]";

export type ClientIdentitySource =
  | "whatsapp_or_phone"
  | "active_conversation"
  | "conversation_phone"
  | "history";

export type ClientIdentityRow = {
  id: number;
  phone?: string | null;
  whatsapp_id?: string | null;
  wispro_id?: string | null;
  created_at?: string | null;
};

export type ResolvedClientIdentity = {
  client: Client;
  source: ClientIdentitySource;
};

const ACTIVE_CONVERSATION_STATUSES = ["abierto", "proceso"] as const;

export const isUniqueViolation = (error: unknown) =>
  Boolean(
    error &&
      typeof error === "object" &&
      "code" in error &&
      String((error as { code?: string }).code) === "23505",
  );

export const phoneLookupVariants = (from: string): string[] => {
  const digits = digitsOnly(from);
  const last10 = phoneLast10(from);
  const variants = new Set<string>();

  if (digits.length >= 8) variants.add(digits);
  if (last10) {
    variants.add(last10);
    if (!last10.startsWith("0")) variants.add(`0${last10}`);
  }

  return [...variants];
};

export const buildPhoneOrFilter = (
  columns: string[],
  from: string,
): string | null => {
  const last10 = phoneLast10(from);
  const variants = phoneLookupVariants(from);
  if (!variants.length && !last10) return null;

  const parts: string[] = [];
  for (const column of columns) {
    for (const variant of variants) {
      parts.push(`${column}.eq.${variant}`);
    }
    if (last10) parts.push(`${column}.like.*${last10}*`);
  }

  return parts.length ? parts.join(",") : null;
};

const hasWispro = (row: ClientIdentityRow) =>
  Boolean(String(row.wispro_id || "").trim());

const exactDigits = (value: string | null | undefined, from: string) => {
  const left = digitsOnly(value);
  const right = digitsOnly(from);
  return Boolean(left && right && left === right);
};

export const identityMatchScore = (
  row: ClientIdentityRow,
  from: string,
): number => {
  let score = 0;
  if (hasWispro(row)) score += 1000;
  if (exactDigits(row.whatsapp_id, from)) score += 100;
  else if (phonesMatch(row.whatsapp_id, from)) score += 50;
  if (exactDigits(row.phone, from)) score += 40;
  else if (phonesMatch(row.phone, from)) score += 20;
  return score;
};

export const rankClientIdentityMatches = <T extends ClientIdentityRow>(
  candidates: T[],
  from: string,
): T[] => {
  const unique = new Map<number, T>();
  for (const candidate of candidates) {
    const id = Number(candidate.id);
    if (!Number.isInteger(id) || id <= 0) continue;
    const previous = unique.get(id);
    if (!previous || identityMatchScore(candidate, from) > identityMatchScore(previous, from)) {
      unique.set(id, { ...candidate, id });
    }
  }

  return [...unique.values()].sort((left, right) => {
    const scoreDelta = identityMatchScore(right, from) - identityMatchScore(left, from);
    if (scoreDelta !== 0) return scoreDelta;

    const leftCreated = left.created_at ? Date.parse(left.created_at) : Number.POSITIVE_INFINITY;
    const rightCreated = right.created_at ? Date.parse(right.created_at) : Number.POSITIVE_INFINITY;
    if (leftCreated !== rightCreated) return leftCreated - rightCreated;

    return Number(left.id) - Number(right.id);
  });
};

export const shouldReleaseWhatsappIdentity = (
  holder: ClientIdentityRow,
  ownerClientId: number,
  from: string,
) => {
  if (Number(holder.id) === Number(ownerClientId)) return false;
  return (
    phonesMatch(holder.whatsapp_id, from) || phonesMatch(holder.phone, from)
  );
};

const loadClientById = async (
  supabase: SupabaseClient,
  clientId: number,
): Promise<Client | null> => {
  const { data, error } = await supabase
    .from("clients")
    .select("*")
    .eq("id", clientId)
    .maybeSingle<Client>();

  if (error) throw error;
  return data;
};

const findClientsByPhoneIdentity = async (
  supabase: SupabaseClient,
  from: string,
): Promise<Client[]> => {
  const orFilter = buildPhoneOrFilter(["whatsapp_id", "phone"], from);
  if (!orFilter) return [];

  const { data, error } = await supabase
    .from("clients")
    .select("*")
    .or(orFilter)
    .limit(50);

  if (error) throw error;

  return ((data || []) as Client[]).filter(
    (row) => phonesMatch(row.whatsapp_id, from) || phonesMatch(row.phone, from),
  );
};

const findConversationClientIdsByPhone = async (
  supabase: SupabaseClient,
  from: string,
  activeOnly: boolean,
): Promise<number[]> => {
  const orFilter = buildPhoneOrFilter(["customer_phone"], from);
  if (!orFilter) return [];

  let query = supabase
    .from("conversations")
    .select("id, client_id, customer_phone")
    .not("client_id", "is", null);

  if (activeOnly) {
    query = query.in("status", [...ACTIVE_CONVERSATION_STATUSES]);
  }

  const { data, error } = await query
    .or(orFilter)
    .order("updated_at", { ascending: false })
    .limit(20);
  if (error) throw error;

  const ids: number[] = [];
  for (const row of data || []) {
    if (!phonesMatch(row.customer_phone, from)) continue;
    const clientId = Number(row.client_id);
    if (Number.isInteger(clientId) && clientId > 0) ids.push(clientId);
  }
  return ids;
};

const findHistoryClientIdsByPhone = async (
  supabase: SupabaseClient,
  from: string,
): Promise<number[]> => {
  const orFilter = buildPhoneOrFilter(["client_phone"], from);
  if (!orFilter) return [];

  const { data, error } = await supabase
    .from("conversation_history")
    .select("client_id, client_phone, resolved_at")
    .not("client_id", "is", null)
    .or(orFilter)
    .order("resolved_at", { ascending: false })
    .limit(20);

  if (error) throw error;

  const ids: number[] = [];
  for (const row of data || []) {
    if (!phonesMatch(row.client_phone, from)) continue;
    const clientId = Number(row.client_id);
    if (Number.isInteger(clientId) && clientId > 0) ids.push(clientId);
  }
  return ids;
};

const loadClientsByIds = async (
  supabase: SupabaseClient,
  ids: number[],
  known: Map<number, Client>,
): Promise<Client[]> => {
  const missing = [...new Set(ids)].filter((id) => !known.has(id));
  if (!missing.length) {
    return ids.map((id) => known.get(id)).filter((row): row is Client => Boolean(row));
  }

  const { data, error } = await supabase
    .from("clients")
    .select("*")
    .in("id", missing.slice(0, 50));

  if (error) throw error;
  for (const row of (data || []) as Client[]) {
    known.set(Number(row.id), row);
  }

  return ids
    .map((id) => known.get(id))
    .filter((row): row is Client => Boolean(row));
};

export const findExistingClientForWhatsapp = async (
  supabase: SupabaseClient,
  from: string,
): Promise<ResolvedClientIdentity | null> => {
  const digits = digitsOnly(from);
  if (digits.length < 8) return null;

  const known = new Map<number, Client>();
  const sourceById = new Map<number, ClientIdentitySource>();

  const remember = (client: Client, source: ClientIdentitySource) => {
    const id = Number(client.id);
    if (!Number.isInteger(id) || id <= 0) return;
    known.set(id, client);
    if (!sourceById.has(id)) sourceById.set(id, source);
  };

  const byIdentity = await findClientsByPhoneIdentity(supabase, from);
  for (const client of byIdentity) remember(client, "whatsapp_or_phone");

  try {
    const activeIds = await findConversationClientIdsByPhone(supabase, from, true);
    for (const client of await loadClientsByIds(supabase, activeIds, known)) {
      remember(client, "active_conversation");
    }
  } catch (error) {
    console.warn(`${LOG_PREFIX} active_conversation_lookup_failed`, {
      error: error instanceof Error ? error.message : String(error),
    });
  }

  try {
    const anyIds = await findConversationClientIdsByPhone(supabase, from, false);
    for (const client of await loadClientsByIds(supabase, anyIds, known)) {
      remember(client, "conversation_phone");
    }
  } catch (error) {
    console.warn(`${LOG_PREFIX} conversation_phone_lookup_failed`, {
      error: error instanceof Error ? error.message : String(error),
    });
  }

  try {
    const historyIds = await findHistoryClientIdsByPhone(supabase, from);
    for (const client of await loadClientsByIds(supabase, historyIds, known)) {
      remember(client, "history");
    }
  } catch (error) {
    console.warn(`${LOG_PREFIX} history_lookup_failed`, {
      error: error instanceof Error ? error.message : String(error),
    });
  }

  const ranked = rankClientIdentityMatches([...known.values()], from);
  const winner = ranked[0];
  if (!winner) return null;

  return {
    client: winner,
    source: sourceById.get(Number(winner.id)) || "whatsapp_or_phone",
  };
};

export const releaseWhatsappIdentityFromOthers = async (
  supabase: SupabaseClient,
  ownerClientId: number,
  from: string,
  options?: { clearPhone?: boolean },
): Promise<number[]> => {
  const holders = await findClientsByPhoneIdentity(supabase, from);
  const releasedIds: number[] = [];

  for (const holder of holders) {
    if (!shouldReleaseWhatsappIdentity(holder, ownerClientId, from)) continue;

    const patch: Record<string, string | null> = {};
    if (phonesMatch(holder.whatsapp_id, from)) {
      patch.whatsapp_id = null;
    }
    if (options?.clearPhone && phonesMatch(holder.phone, from)) {
      patch.phone = null;
    }
    if (!Object.keys(patch).length) continue;

    const { error } = await supabase
      .from("clients")
      .update(patch)
      .eq("id", holder.id);

    if (error) {
      if (options?.clearPhone && !isUniqueViolation(error)) {
        const waOnly: Record<string, string | null> = {};
        if (phonesMatch(holder.whatsapp_id, from)) waOnly.whatsapp_id = null;
        if (!Object.keys(waOnly).length) continue;
        const { error: waError } = await supabase
          .from("clients")
          .update(waOnly)
          .eq("id", holder.id);
        if (waError) throw waError;
      } else {
        throw error;
      }
    }
    releasedIds.push(Number(holder.id));
  }

  return releasedIds;
};

export const claimWhatsappIdentity = async (
  supabase: SupabaseClient,
  client: Client,
  from: string,
  extras?: { waName?: string | null },
): Promise<Client> => {
  const digits = digitsOnly(from);
  if (digits.length < 8) return client;

  const releasedIds = await releaseWhatsappIdentityFromOthers(
    supabase,
    Number(client.id),
    from,
  );

  const payload: Record<string, string | null> = {};
  if (digitsOnly(client.whatsapp_id) !== digits) {
    payload.whatsapp_id = from;
  }
  if (!String(client.phone || "").trim()) {
    payload.phone = from;
  }
  const waName = extras?.waName?.trim() || null;
  if (waName && !String(client.wa_name || "").trim()) {
    payload.wa_name = waName;
  }

  if (!Object.keys(payload).length) {
    if (releasedIds.length) {
      const fresh = await loadClientById(supabase, Number(client.id));
      return fresh ?? client;
    }
    return client;
  }

  const persist = () =>
    supabase.from("clients").update(payload).eq("id", client.id).select("*").single<Client>();

  let { data, error } = await persist();

  if (error && isUniqueViolation(error)) {
    console.warn(`${LOG_PREFIX} claim_unique_retry`, {
      clientId: client.id,
      releasedIds,
    });
    await releaseWhatsappIdentityFromOthers(supabase, Number(client.id), from, {
      clearPhone: true,
    });
    ({ data, error } = await persist());
  }

  if (error && isUniqueViolation(error) && payload.phone) {
    const withoutPhone = { ...payload };
    delete withoutPhone.phone;
    ({ data, error } = await supabase
      .from("clients")
      .update(withoutPhone)
      .eq("id", client.id)
      .select("*")
      .single<Client>());
  }

  if (error) {
    console.warn(`${LOG_PREFIX} claim_failed`, {
      clientId: client.id,
      error: error.message,
    });
    return client;
  }

  return data ?? client;
};
