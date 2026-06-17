import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.NEXT_PUBLIC_SUPABASE_SERVICE_ROLE_KEY!,
);

export async function POST(req: NextRequest) {
  try {
    const { to, message, conversation_id, agent_id } = await req.json();

    // Validaciones básicas
    if (!to || !message || !conversation_id) {
      return NextResponse.json(
        { error: "Faltan campos requeridos" },
        { status: 400 },
      );
    }

    // 1. Enviar mensaje a WhatsApp Cloud API
    const waResponse = await fetch(
      `https://graph.facebook.com/v19.0/${process.env.WHATSAPP_PHONE_NUMBER_ID}/messages`,
      {
        method: "POST",
        headers: {
          Authorization: `Bearer ${process.env.WHATSAPP_TOKEN}`,
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          messaging_product: "whatsapp",
          recipient_type: "individual",
          to: to,
          type: "text",
          text: { body: message },
        }),
      },
    );

    const waData = await waResponse.json();

    // 2. Verificar si Meta lo aceptó
    if (!waResponse.ok || waData.error) {
      console.error("Error Meta:", waData.error);
      return NextResponse.json(
        { error: waData.error?.message || "Error al enviar a WhatsApp" },
        { status: 500 },
      );
    }

    const wa_message_id = waData.messages?.[0]?.id; // wamid.XXXX

    // 3. Guardar mensaje en Supabase
    const { data: savedMessage, error: dbError } = await supabase
      .from("messages")
      .insert({
        conversation_id,
        wa_message_id,
        type: "text",
        content: message,
        sender_type: agent_id ? "agent" : "bot",
        agent_id: agent_id || null,
        status: "sent",
        created_at: new Date().toISOString(),
      })
      .select()
      .single();

    if (dbError) {
      console.error("Error Supabase:", dbError);
      return NextResponse.json(
        { error: "Mensaje enviado pero no registrado en BD" },
        { status: 207 },
      );
    }

    // 4. Actualizar preview y updated_at de la conversación
    await supabase
      .from("conversations")
      .update({
        preview: message,
        updated_at: new Date().toISOString(),
      })
      .eq("id", conversation_id);

    return NextResponse.json({
      success: true,
      wa_message_id,
      message: savedMessage,
    });
  } catch (error) {
    console.error("Error inesperado:", error);
    return NextResponse.json(
      { error: "Error interno del servidor" },
      { status: 500 },
    );
  }
}
