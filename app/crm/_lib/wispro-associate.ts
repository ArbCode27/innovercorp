import type { SupabaseClient } from "@supabase/supabase-js";
import { getColorByIndex, getInitials } from "./formatters";
import { serializeWisproLinkForDb } from "./wispro-webhook";
import type { AssociateWisproInput, Client } from "./types";

const DEFAULT_PLAN = "Sin asignar";
const DEFAULT_ZONE = "Sin asignar";

const throwDbError = (error: { message: string } | null, fallback: string) => {
  if (error) {
    throw new Error(error.message || fallback);
  }
};

const ensureClient = (data: Client | null, fallback: string): Client => {
  if (!data) {
    throw new Error(fallback);
  }
  return data;
};

const normalizePhone = (value?: string | null) => {
  const digits = String(value || "").replace(/\D/g, "");
  return digits.length >= 8 ? digits : "";
};

const clearWisproFieldsFromClient = async (
  supabase: SupabaseClient,
  clientId: number,
) => {
  const { error } = await supabase
    .from("clients")
    .update({
      wispro_id: null,
      envoicing: null,
      account: "Prospecto",
      zone: DEFAULT_ZONE,
    })
    .eq("id", clientId);

  throwDbError(error, "No se pudo liberar la vinculación Wispro previa");
};

const findClientByWhatsappOrPhone = async (
  supabase: SupabaseClient,
  whatsappId?: string | null,
  conversationPhone?: string | null,
) => {
  const wa = normalizePhone(whatsappId) || normalizePhone(conversationPhone);
  if (!wa) return null;

  const { data: byWhatsapp, error: byWhatsappError } = await supabase
    .from("clients")
    .select("*")
    .eq("whatsapp_id", wa)
    .limit(1)
    .maybeSingle<Client>();

  throwDbError(byWhatsappError, "No se pudo buscar el cliente por WhatsApp");
  if (byWhatsapp) return byWhatsapp;

  const { data: byPhone, error: byPhoneError } = await supabase
    .from("clients")
    .select("*")
    .eq("phone", wa)
    .limit(1)
    .maybeSingle<Client>();

  throwDbError(byPhoneError, "No se pudo buscar el cliente por teléfono");
  return byPhone;
};

const createAnchorClient = async (
  supabase: SupabaseClient,
  input: {
    name: string;
    phone: string;
    whatsappId?: string | null;
    waName?: string | null;
    existingClientsCount?: number;
  },
) => {
  let clientsCount = input.existingClientsCount;

  if (clientsCount == null) {
    const { count, error: countError } = await supabase
      .from("clients")
      .select("*", { count: "exact", head: true });

    throwDbError(countError, "No se pudo preparar la asociación");
    clientsCount = count ?? 0;
  }

  const color = getColorByIndex(clientsCount);
  const { data, error } = await supabase
    .from("clients")
    .insert({
      name: input.name,
      phone: input.phone,
      plan: DEFAULT_PLAN,
      zone: DEFAULT_ZONE,
      account: "Prospecto",
      color: color.color,
      bg: color.bg,
      initials: getInitials(input.name),
      ...(input.whatsappId ? { whatsapp_id: input.whatsappId } : {}),
      ...(input.waName ? { wa_name: input.waName } : {}),
    })
    .select()
    .single<Client>();

  throwDbError(error, "No se pudo crear el cliente del chat");
  return ensureClient(data, "No se pudo crear el cliente del chat");
};

/**
 * Links Wispro to the WhatsApp chat client (single identity).
 * Never moves the conversation to a Wispro-only row without WA identity.
 */
export const associateWisproClient = async (
  supabase: SupabaseClient,
  input: AssociateWisproInput,
) => {
  const {
    conversationId,
    customer,
    invoicing,
    existingClientId,
    conversationPhone,
    existingClientsCount,
    whatsappId,
    waName,
  } = input;

  const zone = customer.zone_name?.trim() || DEFAULT_ZONE;
  const envoicingPayload = serializeWisproLinkForDb(invoicing, customer);
  const waIdentity =
    normalizePhone(whatsappId) ||
    normalizePhone(conversationPhone) ||
    normalizePhone(customer.phone_mobile);
  const displayWaName = waName?.trim() || null;

  const { data: existingByWispro, error: lookupError } = await supabase
    .from("clients")
    .select("*")
    .eq("wispro_id", customer.id)
    .maybeSingle<Client>();

  throwDbError(lookupError, "No se pudo buscar el cliente en Wispro");

  // 1) Resolve chat anchor: conversation client → WA/phone match → create.
  let anchor: Client | null = null;

  if (existingClientId) {
    const { data: currentClient, error: currentError } = await supabase
      .from("clients")
      .select("*")
      .eq("id", existingClientId)
      .maybeSingle<Client>();

    throwDbError(currentError, "No se pudo cargar el cliente de la conversación");
    if (!currentClient) {
      throw new Error("El cliente de la conversación no existe");
    }
    anchor = currentClient;
  } else {
    anchor = await findClientByWhatsappOrPhone(
      supabase,
      whatsappId,
      conversationPhone,
    );
  }

  if (!anchor) {
    if (!waIdentity) {
      throw new Error(
        "No hay teléfono/WhatsApp en la conversación para vincular el cliente",
      );
    }

    const anchorName =
      displayWaName ||
      customer.name.trim() ||
      "Número desconocido";

    anchor = await createAnchorClient(supabase, {
      name: anchorName,
      phone: waIdentity,
      whatsappId: waIdentity,
      waName: displayWaName,
      existingClientsCount,
    });
  }

  // 2) Free wispro_id if held by another CRM row (keep WA chat as anchor).
  if (existingByWispro && existingByWispro.id !== anchor.id) {
    await clearWisproFieldsFromClient(supabase, existingByWispro.id);
  }

  // 3) Merge Wispro + ensure WhatsApp identity on the same row.
  const updatePayload: Record<string, string | null> = {
    wispro_id: customer.id,
    name: customer.name,
    zone,
    account: invoicing.accountStatus,
    envoicing: envoicingPayload,
    initials: getInitials(customer.name),
  };

  if (waIdentity) {
    if (!anchor.phone?.trim()) {
      updatePayload.phone = waIdentity;
    }
    if (!anchor.whatsapp_id?.trim()) {
      updatePayload.whatsapp_id = waIdentity;
    }
  } else if (!anchor.phone?.trim() && customer.phone_mobile?.trim()) {
    updatePayload.phone = customer.phone_mobile.trim();
  }

  if (displayWaName && !anchor.wa_name?.trim()) {
    updatePayload.wa_name = displayWaName;
  }

  const { data: updated, error: updateError } = await supabase
    .from("clients")
    .update(updatePayload)
    .eq("id", anchor.id)
    .select()
    .single<Client>();

  throwDbError(updateError, "No se pudo actualizar el cliente");
  const client = ensureClient(updated, "No se pudo actualizar el cliente");

  if (!client.wispro_id) {
    throw new Error("La vinculación no persistió el wispro_id del cliente");
  }

  // 4) Keep conversation on the chat anchor (never switch to a Wispro-only row).
  const customerPhoneForConversation =
    conversationPhone?.trim() ||
    whatsappId?.trim() ||
    client.whatsapp_id?.trim() ||
    client.phone?.trim() ||
    null;

  const { error: conversationError } = await supabase
    .from("conversations")
    .update({
      client_id: client.id,
      ...(customerPhoneForConversation
        ? { customer_phone: customerPhoneForConversation }
        : {}),
      updated_at: new Date().toISOString(),
    })
    .eq("id", conversationId);

  throwDbError(
    conversationError,
    "No se pudo vincular el cliente a la conversación",
  );

  return client;
};

/**
 * Removes Wispro linkage from a CRM client without deleting the WhatsApp identity.
 */
export const unlinkWisproClient = async (
  supabase: SupabaseClient,
  clientId: number,
) => {
  const { data: currentClient, error: lookupError } = await supabase
    .from("clients")
    .select("*")
    .eq("id", clientId)
    .maybeSingle<Client>();

  throwDbError(lookupError, "No se pudo cargar el cliente");
  if (!currentClient) {
    throw new Error("El cliente no existe");
  }

  if (!currentClient.wispro_id) {
    return currentClient;
  }

  const displayName =
    currentClient.wa_name?.trim() ||
    currentClient.name?.trim() ||
    "Número desconocido";

  const { data, error } = await supabase
    .from("clients")
    .update({
      wispro_id: null,
      envoicing: null,
      account: "Prospecto",
      zone: DEFAULT_ZONE,
      name: displayName,
      initials: getInitials(displayName),
    })
    .eq("id", clientId)
    .select()
    .single<Client>();

  throwDbError(error, "No se pudo desvincular Wispro");
  return ensureClient(data, "No se pudo desvincular Wispro");
};
