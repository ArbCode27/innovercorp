import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";
import { z } from "zod";

const LOG_PREFIX = "[BOT_MESSAGE_WEBHOOK]";
const DEFAULT_SENT_BY = "Bot IA";

const payloadSchema = z.object({
  conversation_id: z.coerce.number().int().positive("conversation_id es requerido"),
  content: z
    .string()
    .trim()
    .min(1, "El contenido del mensaje es requerido")
    .max(4096, "El mensaje no puede superar 4096 caracteres"),
  wa_message_id: z
    .string()
    .trim()
    .min(1, "wa_message_id es requerido"),
  from: z
    .string()
    .trim()
    .min(1, "from es requerido"),
  sent_by: z
    .string()
    .trim()
    .min(1)
    .max(120)
    .optional(),
  preview: z
    .string()
    .trim()
    .min(1)
    .max(4096)
    .optional(),
});

type DbConversation = {
  id: number;
  client_id: number | null;
  human_mode: boolean | null;
  customer_phone: string | null;
  status: string | null;
};

type DbClient = {
  id: number;
  phone: string | null;
  whatsapp_id: string | null;
};

type DbMessage = {
  id: number;
  conversation_id: number;
  wa_message_id: string | null;
};

const normalizeWhatsAppPhone = (phone: string) => phone.replace(/\D/g, "");

const getServerEnv = (key: string) => {
  const value = process.env[key];
  if (!value) {
    throw new Error(`Missing environment variable: ${key}`);
  }
  return value;
};

const isDuplicateError = (error: unknown) =>
  Boolean(
    error &&
      typeof error === "object" &&
      "code" in error &&
      String((error as { code?: string }).code) === "23505",
  );

export async function POST(req: NextRequest) {
  try {
    const parsedPayload = payloadSchema.safeParse(await req.json());

    if (!parsedPayload.success) {
      return NextResponse.json(
        { error: parsedPayload.error.issues[0]?.message || "Datos inválidos" },
        { status: 400 },
      );
    }

    const {
      conversation_id,
      content,
      wa_message_id,
      from,
      sent_by,
      preview,
    } = parsedPayload.data;

    const normalizedFrom = normalizeWhatsAppPhone(from);
    if (normalizedFrom.length < 8 || normalizedFrom.length > 15) {
      return NextResponse.json(
        { error: "El número de WhatsApp no tiene un formato válido" },
        { status: 400 },
      );
    }

    const supabase = createClient(
      getServerEnv("NEXT_PUBLIC_SUPABASE_URL"),
      getServerEnv("SUPABASE_SERVICE_ROLE_KEY"),
    );

    const { data: existingByWaId, error: existingByWaIdError } = await supabase
      .from("messages")
      .select("id, conversation_id, wa_message_id")
      .eq("wa_message_id", wa_message_id)
      .limit(1)
      .maybeSingle<DbMessage>();

    if (existingByWaIdError) {
      console.error(`${LOG_PREFIX} duplicate_lookup_failed`, existingByWaIdError);
      return NextResponse.json(
        { error: "No se pudo validar el mensaje" },
        { status: 500 },
      );
    }

    if (existingByWaId) {
      console.log(`${LOG_PREFIX} duplicate_ignored`, {
        messageId: existingByWaId.id,
        waMessageId: wa_message_id,
        conversationId: existingByWaId.conversation_id,
      });

      return NextResponse.json({
        success: true,
        already_exists: true,
        message_id: existingByWaId.id,
        conversation_id: existingByWaId.conversation_id,
        wa_message_id: existingByWaId.wa_message_id,
      });
    }

    const { data: conversation, error: conversationError } = await supabase
      .from("conversations")
      .select("id, client_id, human_mode, customer_phone, status")
      .eq("id", conversation_id)
      .maybeSingle<DbConversation>();

    if (conversationError) {
      console.error(`${LOG_PREFIX} conversation_lookup_failed`, conversationError);
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

    if (conversation.status === "resuelto") {
      return NextResponse.json(
        { error: "La conversación ya está resuelta" },
        { status: 409 },
      );
    }

    if (Boolean(conversation.human_mode)) {
      return NextResponse.json(
        {
          error:
            "La conversación está en modo humano; el bot no debe registrar mensajes",
        },
        { status: 403 },
      );
    }

    const knownPhones: string[] = [];
    if (conversation.customer_phone) {
      knownPhones.push(normalizeWhatsAppPhone(conversation.customer_phone));
    }

    if (conversation.client_id) {
      const { data: client, error: clientError } = await supabase
        .from("clients")
        .select("id, phone, whatsapp_id")
        .eq("id", conversation.client_id)
        .maybeSingle<DbClient>();

      if (clientError) {
        console.error(`${LOG_PREFIX} client_lookup_failed`, clientError);
        return NextResponse.json(
          { error: "No se pudo validar el cliente de la conversación" },
          { status: 500 },
        );
      }

      if (client?.whatsapp_id) {
        knownPhones.push(normalizeWhatsAppPhone(client.whatsapp_id));
      }
      if (client?.phone) {
        knownPhones.push(normalizeWhatsAppPhone(client.phone));
      }
    }

    const uniqueKnownPhones = [...new Set(knownPhones.filter(Boolean))];
    if (
      uniqueKnownPhones.length > 0 &&
      !uniqueKnownPhones.includes(normalizedFrom)
    ) {
      return NextResponse.json(
        {
          error:
            "El número from no coincide con el contacto de la conversación",
        },
        { status: 400 },
      );
    }

    if (uniqueKnownPhones.length === 0) {
      return NextResponse.json(
        {
          error:
            "La conversación no tiene un teléfono de contacto para validar el mensaje",
        },
        { status: 400 },
      );
    }

    const now = new Date().toISOString();
    const messagePreview = (preview || content).trim();
    const botLabel = (sent_by || DEFAULT_SENT_BY).trim() || DEFAULT_SENT_BY;

    const { data: savedMessage, error: insertError } = await supabase
      .from("messages")
      .insert({
        conversation_id,
        wa_message_id,
        type: "out",
        content,
        sender_type: "bot",
        sent_by: botLabel,
        status: "sent",
        created_at: now,
      })
      .select("id, conversation_id, wa_message_id")
      .single<DbMessage>();

    if (insertError) {
      if (isDuplicateError(insertError)) {
        const { data: duplicatedMessage } = await supabase
          .from("messages")
          .select("id, conversation_id, wa_message_id")
          .eq("wa_message_id", wa_message_id)
          .limit(1)
          .maybeSingle<DbMessage>();

        if (duplicatedMessage) {
          return NextResponse.json({
            success: true,
            already_exists: true,
            message_id: duplicatedMessage.id,
            conversation_id: duplicatedMessage.conversation_id,
            wa_message_id: duplicatedMessage.wa_message_id,
          });
        }
      }

      console.error(`${LOG_PREFIX} message_insert_failed`, insertError);
      return NextResponse.json(
        { error: "No se pudo registrar el mensaje del bot" },
        { status: 500 },
      );
    }

    const { error: conversationUpdateError } = await supabase
      .from("conversations")
      .update({
        preview: messagePreview,
        updated_at: now,
        last_message_at: now,
      })
      .eq("id", conversation_id);

    if (conversationUpdateError) {
      console.error(
        `${LOG_PREFIX} conversation_update_failed`,
        conversationUpdateError,
      );
      return NextResponse.json(
        {
          error: "Mensaje registrado pero no se actualizó la conversación",
          message_id: savedMessage.id,
          conversation_id,
          wa_message_id,
        },
        { status: 500 },
      );
    }

    console.log(`${LOG_PREFIX} message_saved`, {
      messageId: savedMessage.id,
      conversationId: conversation_id,
      waMessageId: wa_message_id,
    });

    return NextResponse.json({
      success: true,
      already_exists: false,
      message_id: savedMessage.id,
      conversation_id,
      wa_message_id,
    });
  } catch (error) {
    if (
      error instanceof Error &&
      error.message.startsWith("Missing environment")
    ) {
      console.error(`${LOG_PREFIX} missing_env`, error.message);
      return NextResponse.json(
        { error: "CRM no configurado en el servidor" },
        { status: 503 },
      );
    }

    console.error(`${LOG_PREFIX} unexpected_error`, error);
    return NextResponse.json(
      { error: "Error interno al registrar el mensaje del bot" },
      { status: 500 },
    );
  }
}
