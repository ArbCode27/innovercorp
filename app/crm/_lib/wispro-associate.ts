import type { SupabaseClient } from "@supabase/supabase-js";
import { getColorByIndex, getInitials } from "./formatters";
import { serializeInvoicingForDb } from "./wispro-webhook";
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

const resolveClientPhone = (
  customerPhone?: string | null,
  conversationPhone?: string | null,
) => {
  const phone = customerPhone?.trim() || conversationPhone?.trim() || "";

  if (!phone) {
    throw new Error(
      "El cliente de Wispro no tiene teléfono registrado. No se puede crear el cliente.",
    );
  }

  return phone;
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

/**
 * Links (or re-links) a Wispro customer to a CRM conversation's client.
 * Preserves WhatsApp identity on re-link; frees wispro_id if held by another client.
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
  const envoicingPayload = serializeInvoicingForDb(invoicing);

  const { data: existingByWispro, error: lookupError } = await supabase
    .from("clients")
    .select("*")
    .eq("wispro_id", customer.id)
    .maybeSingle<Client>();

  throwDbError(lookupError, "No se pudo buscar el cliente en Wispro");

  let client: Client;

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

    // Same Wispro already on another CRM row → free it so this chat keeps its WA identity.
    if (existingByWispro && existingByWispro.id !== existingClientId) {
      await clearWisproFieldsFromClient(supabase, existingByWispro.id);
    }

    const updatePayload: Record<string, string | null> = {
      wispro_id: customer.id,
      name: customer.name,
      zone,
      account: invoicing.accountStatus,
      envoicing: envoicingPayload,
      initials: getInitials(customer.name),
    };

    // Preserve WhatsApp identity; only fill missing phone from Wispro/conversation.
    if (!currentClient.phone?.trim()) {
      const fallbackPhone =
        conversationPhone?.trim() ||
        customer.phone_mobile?.trim() ||
        whatsappId?.trim() ||
        "";
      if (fallbackPhone) {
        updatePayload.phone = fallbackPhone;
      }
    }

    if (whatsappId && !currentClient.whatsapp_id) {
      updatePayload.whatsapp_id = whatsappId;
    }

    if (waName && !currentClient.wa_name) {
      updatePayload.wa_name = waName;
    }

    const { data, error } = await supabase
      .from("clients")
      .update(updatePayload)
      .eq("id", existingClientId)
      .select()
      .single<Client>();

    throwDbError(error, "No se pudo actualizar el cliente");
    client = ensureClient(data, "No se pudo actualizar el cliente");
  } else if (existingByWispro) {
    const { data, error } = await supabase
      .from("clients")
      .update({
        wispro_id: customer.id,
        name: customer.name,
        zone,
        phone: resolveClientPhone(customer.phone_mobile, conversationPhone),
        account: invoicing.accountStatus,
        envoicing: envoicingPayload,
        initials: getInitials(customer.name),
        ...(whatsappId ? { whatsapp_id: whatsappId } : {}),
        ...(waName ? { wa_name: waName } : {}),
      })
      .eq("id", existingByWispro.id)
      .select()
      .single<Client>();

    throwDbError(error, "No se pudo actualizar el cliente de Wispro");
    client = ensureClient(data, "No se pudo actualizar el cliente de Wispro");
  } else {
    const phone = resolveClientPhone(customer.phone_mobile, conversationPhone);
    let clientsCount = existingClientsCount;

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
        name: customer.name,
        phone,
        plan: DEFAULT_PLAN,
        zone,
        account: invoicing.accountStatus,
        envoicing: envoicingPayload,
        wispro_id: customer.id,
        color: color.color,
        bg: color.bg,
        initials: getInitials(customer.name),
        ...(whatsappId ? { whatsapp_id: whatsappId } : {}),
        ...(waName ? { wa_name: waName } : {}),
      })
      .select()
      .single<Client>();

    throwDbError(error, "No se pudo crear el cliente");
    client = ensureClient(data, "No se pudo crear el cliente");
  }

  const { error: conversationError } = await supabase
    .from("conversations")
    .update({
      client_id: client.id,
      ...(conversationPhone?.trim()
        ? { customer_phone: conversationPhone.trim() }
        : whatsappId?.trim()
          ? { customer_phone: whatsappId.trim() }
          : {}),
      updated_at: new Date().toISOString(),
    })
    .eq("id", conversationId);

  throwDbError(conversationError, "No se pudo vincular el cliente a la conversación");

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
