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

  const phone = resolveClientPhone(customer.phone_mobile, conversationPhone);
  const zone = customer.zone_name?.trim() || DEFAULT_ZONE;
  const envoicingPayload = serializeInvoicingForDb(invoicing);

  const wisproFields: Record<string, string | null> = {
    wispro_id: customer.id,
    name: customer.name,
    zone,
    phone,
    account: invoicing.accountStatus,
    envoicing: envoicingPayload,
  };

  const { data: existingByWispro, error: lookupError } = await supabase
    .from("clients")
    .select("*")
    .eq("wispro_id", customer.id)
    .maybeSingle<Client>();

  throwDbError(lookupError, "No se pudo buscar el cliente en Wispro");

  let client: Client;

  if (existingClientId) {
    const updatePayload: Record<string, string | null> = { ...wisproFields };

    if (whatsappId) {
      updatePayload.whatsapp_id = whatsappId;
    }

    if (waName) {
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
      .update(wisproFields)
      .eq("id", existingByWispro.id)
      .select()
      .single<Client>();

    throwDbError(error, "No se pudo actualizar el cliente de Wispro");
    client = ensureClient(data, "No se pudo actualizar el cliente de Wispro");
  } else {
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
      updated_at: new Date().toISOString(),
    })
    .eq("id", conversationId);

  throwDbError(conversationError, "No se pudo vincular el cliente a la conversación");

  return client;
};
