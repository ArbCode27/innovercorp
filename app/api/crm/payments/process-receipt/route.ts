import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";
import { z } from "zod";

const DEFAULT_CEDULA = "00000000";
const DEFAULT_MAKE_PAYMENT_RECEIPT_WEBHOOK_URL =
  "https://hook.us2.make.com/mh1c3q2r32pvme548npr9jegiphkgopz";

const payloadSchema = z.object({
  messageId: z.coerce.number().int().positive(),
  conversationId: z.coerce.number().int().positive(),
  agentId: z.coerce.number().int().positive(),
});

type DbMessage = {
  id: number;
  conversation_id: number;
  wa_message_id: string | null;
  media_url: string | null;
  media_type: string | null;
  type: string;
  metadata: Record<string, unknown> | null;
};

type DbConversation = {
  id: number;
  client_id: number | null;
  agent_id: number | null;
};

type DbClient = {
  id: number;
  name: string | null;
  phone: string | null;
  whatsapp_id: string | null;
  cedula?: string | null;
  national_identification_number?: string | null;
  document_number?: string | null;
  dni?: string | null;
};

type DbAgent = {
  id: number;
  role: string | null;
};

const getServerEnv = (key: string) => {
  const value = process.env[key];
  if (!value) {
    throw new Error(`Missing environment variable: ${key}`);
  }
  return value;
};

const getMakeWebhookUrl = () =>
  process.env.MAKE_PAYMENT_RECEIPT_WEBHOOK_URL ||
  DEFAULT_MAKE_PAYMENT_RECEIPT_WEBHOOK_URL;

const toNonEmptyString = (value: unknown) => {
  if (typeof value !== "string") return null;
  const trimmed = value.trim();
  return trimmed || null;
};

const extractCedula = (client: DbClient) =>
  toNonEmptyString(client.cedula) ||
  toNonEmptyString(client.national_identification_number) ||
  toNonEmptyString(client.document_number) ||
  toNonEmptyString(client.dni) ||
  DEFAULT_CEDULA;

const extractPhoneId = (client: DbClient) =>
  toNonEmptyString(client.whatsapp_id) || toNonEmptyString(client.phone) || "";

const readMetadataFlag = (
  metadata: Record<string, unknown> | null,
  key: string,
) => {
  const value = metadata?.[key];
  if (typeof value === "boolean") return value;
  if (typeof value === "string") return value.toLowerCase() === "true";
  return false;
};

export async function POST(req: NextRequest) {
  try {
    const parsedPayload = payloadSchema.safeParse(await req.json());
    if (!parsedPayload.success) {
      return NextResponse.json(
        { error: parsedPayload.error.issues[0]?.message || "Datos inválidos" },
        { status: 400 },
      );
    }

    const { messageId, conversationId, agentId } = parsedPayload.data;

    const supabase = createClient(
      getServerEnv("NEXT_PUBLIC_SUPABASE_URL"),
      getServerEnv("SUPABASE_SERVICE_ROLE_KEY"),
    );

    const { data: agent, error: agentError } = await supabase
      .from("agents")
      .select("id, role")
      .eq("id", agentId)
      .maybeSingle<DbAgent>();

    if (agentError) {
      console.error("Process receipt agent lookup:", agentError);
      return NextResponse.json(
        { error: "No se pudo validar el asesor" },
        { status: 500 },
      );
    }

    if (!agent) {
      return NextResponse.json(
        { error: "El asesor no existe" },
        { status: 404 },
      );
    }

    const isAdmin = String(agent.role || "").toLowerCase() === "admin";

    const { data: conversation, error: conversationError } = await supabase
      .from("conversations")
      .select("id, client_id, agent_id")
      .eq("id", conversationId)
      .maybeSingle<DbConversation>();

    if (conversationError) {
      console.error("Process receipt conversation lookup:", conversationError);
      return NextResponse.json(
        { error: "No se pudo validar la conversación" },
        { status: 500 },
      );
    }

    if (!conversation) {
      return NextResponse.json(
        { error: "La conversación no existe" },
        { status: 404 },
      );
    }

    if (
      conversation.agent_id &&
      conversation.agent_id !== agentId &&
      !isAdmin
    ) {
      return NextResponse.json(
        {
          error:
            "Esta conversación está asignada a otro asesor y no puedes procesar su comprobante",
        },
        { status: 403 },
      );
    }

    const { data: message, error: messageError } = await supabase
      .from("messages")
      .select("id, conversation_id, wa_message_id, media_url, media_type, type, metadata")
      .eq("id", messageId)
      .maybeSingle<DbMessage>();

    if (messageError) {
      console.error("Process receipt message lookup:", messageError);
      return NextResponse.json(
        { error: "No se pudo validar el mensaje" },
        { status: 500 },
      );
    }

    if (!message) {
      return NextResponse.json(
        { error: "El mensaje no existe" },
        { status: 404 },
      );
    }

    if (message.conversation_id !== conversationId) {
      return NextResponse.json(
        { error: "El mensaje no pertenece a la conversación indicada" },
        { status: 400 },
      );
    }

    if (message.type !== "in" || message.media_type !== "image") {
      return NextResponse.json(
        { error: "Solo se pueden procesar imágenes enviadas por clientes" },
        { status: 400 },
      );
    }

    const fileUrl = toNonEmptyString(message.media_url);
    if (!fileUrl) {
      return NextResponse.json(
        { error: "La imagen no tiene URL pública disponible" },
        { status: 400 },
      );
    }

    if (!conversation.client_id) {
      return NextResponse.json(
        { error: "La conversación no tiene un cliente asociado" },
        { status: 404 },
      );
    }

    const { data: client, error: clientError } = await supabase
      .from("clients")
      .select("*")
      .eq("id", conversation.client_id)
      .maybeSingle<DbClient>();

    if (clientError) {
      console.error("Process receipt client lookup:", clientError);
      return NextResponse.json(
        { error: "No se pudo validar el cliente de la conversación" },
        { status: 500 },
      );
    }

    if (!client) {
      return NextResponse.json({ error: "Cliente no encontrado" }, { status: 404 });
    }

    const alreadyRequested = readMetadataFlag(
      message.metadata,
      "payment_receipt_requested",
    );

    if (alreadyRequested) {
      return NextResponse.json({
        success: true,
        alreadyProcessed: true,
        messageId: message.id,
      });
    }

    const cedula = extractCedula(client);
    const cedulaIsDefault = cedula === DEFAULT_CEDULA;
    const phoneId = extractPhoneId(client);
    const clientName = toNonEmptyString(client.name) || "Cliente sin nombre";
    const metadata = (message.metadata || {}) as Record<string, unknown>;
    const storagePath = toNonEmptyString(metadata.storage_path);
    const storageBucket = toNonEmptyString(metadata.storage_bucket);

    const webhookPayload = {
      event_type: "payment_receipt_requested",
      file_url: fileUrl,
      cedula,
      cedula_is_default: cedulaIsDefault,
      phone_id: phoneId,
      client_name: clientName,
      message_id: message.id,
      wa_message_id: message.wa_message_id,
      conversation_id: conversation.id,
      client_id: client.id,
      agent_id: agentId,
      storage_bucket: storageBucket,
      storage_path: storagePath,
    };

    const makeResponse = await fetch(getMakeWebhookUrl(), {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(webhookPayload),
    });

    const makeResponseBody = await makeResponse.text();
    if (!makeResponse.ok) {
      console.error("Process receipt Make webhook failed:", {
        status: makeResponse.status,
        body: makeResponseBody,
      });
      return NextResponse.json(
        { error: "No se pudo enviar el comprobante a Make" },
        { status: 502 },
      );
    }

    const nextMetadata: Record<string, unknown> = {
      ...metadata,
      payment_receipt_requested: true,
      payment_receipt_requested_at: new Date().toISOString(),
      payment_receipt_requested_by: agentId,
      payment_receipt_make_response_status: makeResponse.status,
      payment_receipt_make_response_body: makeResponseBody || null,
    };

    const { error: updateMessageError } = await supabase
      .from("messages")
      .update({ metadata: nextMetadata })
      .eq("id", message.id);

    if (updateMessageError) {
      console.error("Process receipt update message metadata:", updateMessageError);
    }

    return NextResponse.json({
      success: true,
      alreadyProcessed: false,
      messageId: message.id,
    });
  } catch (error) {
    if (error instanceof Error && error.message.startsWith("Missing environment")) {
      console.error(error.message);
      return NextResponse.json(
        { error: "CRM no configurado en el servidor" },
        { status: 503 },
      );
    }

    console.error("Process receipt error:", error);
    return NextResponse.json(
      { error: "Error interno al procesar el comprobante" },
      { status: 500 },
    );
  }
}
