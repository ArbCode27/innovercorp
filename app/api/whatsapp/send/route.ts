import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";
import { z } from "zod";
import {
  maskWhatsAppPhone,
  parseWhatsAppGraphError,
} from "@/app/api/whatsapp/_lib/whatsapp-outbound-log";

const GRAPH_API_VERSION = "v19.0";
const LOG_PREFIX = "[WHATSAPP_SEND]";

const sendMessageSchema = z.object({
  to: z.string().trim().min(1, "El destinatario es requerido"),
  message: z
    .string()
    .trim()
    .min(1, "El mensaje no puede estar vacío")
    .max(4096, "El mensaje no puede superar 4096 caracteres"),
  conversation_id: z.coerce.number().int().positive(),
  agent_id: z.coerce.number().int().positive().optional(),
});

const normalizeWhatsAppPhone = (phone: string) => phone.replace(/\D/g, "");

const getServerEnv = (key: string) => {
  const value = process.env[key];

  if (!value) {
    throw new Error(`Missing environment variable: ${key}`);
  }

  return value;
};

const reject = (
  status: number,
  error: string,
  reason: string,
  extra?: Record<string, unknown>,
) => {
  console.warn(`${LOG_PREFIX} rejected`, {
    reason,
    status,
    error,
    ...extra,
  });
  return NextResponse.json({ error }, { status });
};

export async function POST(req: NextRequest) {
  let conversationId: number | null = null;
  let agentId: number | null = null;
  let maskedTo: string | null = null;

  try {
    const payload = sendMessageSchema.safeParse(await req.json());

    if (!payload.success) {
      return reject(
        400,
        payload.error.issues[0]?.message || "Datos inválidos",
        "invalid_payload",
      );
    }

    const { to, message, conversation_id, agent_id } = payload.data;
    conversationId = conversation_id;
    agentId = agent_id ?? null;
    const normalizedTo = normalizeWhatsAppPhone(to);
    maskedTo = maskWhatsAppPhone(normalizedTo);
    let sentBy: string | null = null;

    console.log(`${LOG_PREFIX} started`, {
      conversationId,
      agentId,
      to: maskedTo,
      messageChars: message.length,
    });

    if (normalizedTo.length < 8 || normalizedTo.length > 15) {
      return reject(
        400,
        "El número de WhatsApp no tiene un formato válido",
        "invalid_phone",
        {
          conversationId,
          agentId,
          to: maskedTo,
          digits: normalizedTo.length,
        },
      );
    }

    const supabase = createClient(
      getServerEnv("NEXT_PUBLIC_SUPABASE_URL"),
      getServerEnv("SUPABASE_SERVICE_ROLE_KEY"),
    );

    const { data: conversation, error: conversationError } = await supabase
      .from("conversations")
      .select("id, client_id, customer_phone")
      .eq("id", conversation_id)
      .maybeSingle();

    if (conversationError) {
      console.error(`${LOG_PREFIX} conversation_lookup_failed`, {
        conversationId,
        error: conversationError.message,
      });
      return NextResponse.json(
        { error: "No se pudo validar la conversación" },
        { status: 500 },
      );
    }

    if (!conversation) {
      return reject(404, "La conversación no existe", "conversation_not_found", {
        conversationId,
        agentId,
      });
    }

    if (agent_id) {
      const { data: agent, error: agentError } = await supabase
        .from("agents")
        .select("id, name, status")
        .eq("id", agent_id)
        .maybeSingle();

      if (agentError) {
        console.error(`${LOG_PREFIX} agent_lookup_failed`, {
          conversationId,
          agentId,
          error: agentError.message,
        });
        return NextResponse.json(
          { error: "No se pudo validar el agente" },
          { status: 500 },
        );
      }

      if (!agent) {
        return reject(404, "El agente no existe", "agent_not_found", {
          conversationId,
          agentId,
        });
      }

      if (agent.status === "inactive") {
        return reject(
          403,
          "El agente está inactivo y no puede enviar mensajes",
          "agent_inactive",
          { conversationId, agentId },
        );
      }

      sentBy = agent.name;
    }

    const knownPhones: string[] = [];
    if (conversation.customer_phone) {
      knownPhones.push(normalizeWhatsAppPhone(conversation.customer_phone));
    }

    if (conversation.client_id) {
      const { data: client, error: clientError } = await supabase
        .from("clients")
        .select("phone, whatsapp_id")
        .eq("id", conversation.client_id)
        .maybeSingle();

      if (clientError) {
        console.error(`${LOG_PREFIX} client_lookup_failed`, {
          conversationId,
          clientId: conversation.client_id,
          error: clientError.message,
        });
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
      !uniqueKnownPhones.includes(normalizedTo)
    ) {
      return reject(
        400,
        "El destinatario no coincide con el contacto de la conversación",
        "recipient_mismatch",
        {
          conversationId,
          agentId,
          to: maskedTo,
          knownCount: uniqueKnownPhones.length,
        },
      );
    }

    const waResponse = await fetch(
      `https://graph.facebook.com/${GRAPH_API_VERSION}/${getServerEnv(
        "WHATSAPP_PHONE_NUMBER_ID",
      )}/messages`,
      {
        method: "POST",
        headers: {
          Authorization: `Bearer ${getServerEnv("WHATSAPP_TOKEN")}`,
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          messaging_product: "whatsapp",
          recipient_type: "individual",
          to: normalizedTo,
          type: "text",
          text: { body: message },
        }),
      },
    );

    const waData = await waResponse.json();
    const graphError = parseWhatsAppGraphError(waData);

    if (!waResponse.ok || waData.error) {
      console.error(`${LOG_PREFIX} meta_send_failed`, {
        conversationId,
        agentId,
        to: maskedTo,
        httpStatus: waResponse.status,
        error: graphError,
      });
      return NextResponse.json(
        {
          error:
            graphError?.message ||
            waData.error?.message ||
            "Error al enviar a WhatsApp",
        },
        { status: 500 },
      );
    }

    const wa_message_id = waData.messages?.[0]?.id || null;

    const { data: savedMessage, error: dbError } = await supabase
      .from("messages")
      .insert({
        conversation_id,
        wa_message_id,
        type: "out",
        content: message,
        sender_type: agent_id ? "agent" : "bot",
        sent_by: sentBy ?? "Bot IA",
        status: "sent",
        created_at: new Date().toISOString(),
      })
      .select()
      .single();

    if (dbError) {
      console.error(`${LOG_PREFIX} persist_failed`, {
        conversationId,
        agentId,
        to: maskedTo,
        waMessageId: wa_message_id,
        error: dbError.message,
      });
      return NextResponse.json(
        { error: "Mensaje enviado pero no registrado en BD" },
        { status: 500 },
      );
    }

    const now = new Date().toISOString();
    const { error: conversationUpdateError } = await supabase
      .from("conversations")
      .update({
        preview: message,
        updated_at: now,
        last_message_at: now,
      })
      .eq("id", conversation_id);

    if (conversationUpdateError) {
      console.error(`${LOG_PREFIX} conversation_update_failed`, {
        conversationId,
        error: conversationUpdateError.message,
      });
      return NextResponse.json(
        { error: "Mensaje enviado pero no se actualizó la conversación" },
        { status: 500 },
      );
    }

    console.log(`${LOG_PREFIX} sent`, {
      conversationId,
      agentId,
      to: maskedTo,
      waMessageId: wa_message_id,
      messageId: savedMessage?.id ?? null,
      httpStatus: waResponse.status,
    });

    return NextResponse.json({
      success: true,
      wa_message_id,
      message: savedMessage,
    });
  } catch (error) {
    if (
      error instanceof Error &&
      error.message.startsWith("Missing environment")
    ) {
      console.error(`${LOG_PREFIX} missing_env`, {
        conversationId,
        agentId,
        to: maskedTo,
        error: error.message,
      });
      return NextResponse.json(
        { error: "WhatsApp no configurado en el servidor" },
        { status: 503 },
      );
    }

    console.error(`${LOG_PREFIX} unexpected_error`, {
      conversationId,
      agentId,
      to: maskedTo,
      error: error instanceof Error ? error.message : String(error),
    });
    return NextResponse.json(
      { error: "Error interno del servidor" },
      { status: 500 },
    );
  }
}
