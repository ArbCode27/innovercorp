import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";
import { z } from "zod";
import { extractPaymentReceiptWithAi } from "@/app/api/crm/_lib/receipt-extractor";
import { resolveLinkedClientIdentity } from "@/app/crm/_lib/client-profile-utils";

const payloadSchema = z.object({
  messageId: z.coerce.number().int().positive(),
  conversationId: z.coerce.number().int().positive(),
});

const getServerEnv = (key: string) => {
  const value = process.env[key];
  if (!value) throw new Error(`Missing environment variable: ${key}`);
  return value;
};

const getServiceClient = () =>
  createClient(
    getServerEnv("NEXT_PUBLIC_SUPABASE_URL"),
    getServerEnv("SUPABASE_SERVICE_ROLE_KEY"),
  );

export async function POST(req: NextRequest) {
  try {
    const body = await req.json();
    const parsedPayload = payloadSchema.safeParse(body);

    if (!parsedPayload.success) {
      return NextResponse.json(
        { error: parsedPayload.error.issues[0]?.message || "Datos inválidos" },
        { status: 400 },
      );
    }

    const { messageId, conversationId } = parsedPayload.data;
    const supabase = getServiceClient();

    // 1. Fetch message
    const { data: message, error: messageError } = await supabase
      .from("messages")
      .select("id, conversation_id, media_url, media_type, caption, metadata, type")
      .eq("id", messageId)
      .maybeSingle();

    if (messageError || !message) {
      return NextResponse.json(
        { error: "No se encontró el mensaje del comprobante" },
        { status: 404 },
      );
    }

    if (!message.media_url?.trim()) {
      return NextResponse.json(
        { error: "El mensaje no tiene una URL de imagen válida" },
        { status: 400 },
      );
    }

    // 2. Fetch conversation & client
    const { data: conversation } = await supabase
      .from("conversations")
      .select("id, client_id, customer_phone")
      .eq("id", conversationId)
      .maybeSingle();

    let clientIdentity = {
      linked: false,
      wisproId: null as string | null,
      cedula: null as string | null,
      name: null as string | null,
    };

    if (conversation?.client_id) {
      const { data: client } = await supabase
        .from("clients")
        .select("id, name, phone, whatsapp_id, wispro_id, envoicing")
        .eq("id", conversation.client_id)
        .maybeSingle();

      if (client) {
        clientIdentity = resolveLinkedClientIdentity(client);
      }
    }

    // 3. Fetch recent messages for context (helps detect which bank the customer mentioned)
    const { data: recentMessages } = await supabase
      .from("messages")
      .select("id, type, content, sender_type, created_at, media_type")
      .eq("conversation_id", conversationId)
      .order("created_at", { ascending: false })
      .limit(8);

    const chronological = (recentMessages || []).reverse();
    const chatContextLines = chronological
      .map((msg) => {
        const sender = msg.type === "in" ? "Cliente" : msg.sender_type === "bot" ? "Bot IA" : "Asesor";
        const text = msg.content?.trim() || (msg.media_type ? `[${msg.media_type}]` : "");
        return text ? `${sender}: ${text}` : null;
      })
      .filter(Boolean)
      .join("\n");

    // 4. Run AI extraction
    const extraction = await extractPaymentReceiptWithAi({
      imageUrl: message.media_url,
      chatContextText: chatContextLines,
      timeoutMs: 25_000,
    });

    return NextResponse.json({
      ok: true,
      extraction: {
        ...extraction,
        imageUrl: message.media_url,
        messageId,
        conversationId,
        clientName: clientIdentity.name,
        cedula: clientIdentity.cedula,
        wisproClientId: clientIdentity.wisproId,
        isClientLinked: clientIdentity.linked,
      },
    });
  } catch (error) {
    console.error("[EXTRACT_RECEIPT] error", error);
    return NextResponse.json(
      {
        error:
          error instanceof Error
            ? error.message
            : "Error inesperado al extraer el comprobante",
      },
      { status: 500 },
    );
  }
}
