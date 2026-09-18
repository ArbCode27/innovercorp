import type { SupabaseClient } from "@supabase/supabase-js";

const GRAPH_API_VERSION = "v19.0";
const IMAGE_MAX_BYTES = 5 * 1024 * 1024;

const getServerEnv = (key: string) => {
  const value = process.env[key];
  if (!value) throw new Error(`Missing environment variable: ${key}`);
  return value;
};

const normalizePhone = (phone: string) => phone.replace(/\D/g, "");

const isAllowedImageMime = (mimeType: string) => {
  const normalized = mimeType.toLowerCase();
  return (
    normalized === "image/jpeg" ||
    normalized === "image/jpg" ||
    normalized === "image/png" ||
    normalized === "image/webp"
  );
};

const guessMimeFromUrl = (url: string) => {
  const lower = url.toLowerCase();
  if (lower.includes(".png")) return "image/png";
  if (lower.includes(".webp")) return "image/webp";
  return "image/jpeg";
};

const persistOutbound = async (
  supabase: SupabaseClient,
  input: {
    conversationId: number;
    waMessageId: string | null;
    content: string;
    mediaUrl?: string | null;
    mediaType?: "image" | null;
    metadata?: Record<string, unknown>;
  },
) => {
  const now = new Date().toISOString();
  const { error } = await supabase.from("messages").insert({
    conversation_id: input.conversationId,
    wa_message_id: input.waMessageId,
    type: "out",
    content: input.content,
    media_url: input.mediaUrl || null,
    media_type: input.mediaType || null,
    sender_type: "bot",
    sent_by: "Bot IA",
    status: "sent",
    created_at: now,
    metadata: input.metadata || { engine: "ai", action: "technician_report" },
  });

  if (error) {
    console.error("[WHATSAPP] persist_outbound_failed", error.message);
  }

  await supabase
    .from("conversations")
    .update({
      preview: input.content.slice(0, 180),
      updated_at: now,
      last_message_at: now,
    })
    .eq("id", input.conversationId);
};

export const sendWhatsAppText = async (input: {
  to: string;
  body: string;
  supabase: SupabaseClient;
  conversationId: number;
  metadata?: Record<string, unknown>;
  persist?: boolean;
}) => {
  const to = normalizePhone(input.to);
  const response = await fetch(
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
        to,
        type: "text",
        text: { body: input.body },
      }),
    },
  );

  const data = (await response.json()) as {
    messages?: Array<{ id?: string }>;
    error?: { message?: string };
  };
  if (!response.ok || data.error) {
    throw new Error(data.error?.message || "Error al enviar texto por WhatsApp");
  }

  const waMessageId = String(data.messages?.[0]?.id || "") || null;
  if (input.persist !== false) {
    await persistOutbound(input.supabase, {
      conversationId: input.conversationId,
      waMessageId,
      content: input.body,
      metadata: input.metadata,
    });
  }
  return waMessageId;
};

export const sendWhatsAppImageFromUrl = async (input: {
  to: string;
  imageUrl: string;
  caption: string;
  supabase: SupabaseClient;
  conversationId: number;
  metadata?: Record<string, unknown>;
}) => {
  const to = normalizePhone(input.to);
  const imageResponse = await fetch(input.imageUrl, {
    method: "GET",
    cache: "no-store",
    signal: AbortSignal.timeout(20_000),
  });
  if (!imageResponse.ok) {
    throw new Error("No se pudo descargar la foto de fachada");
  }

  const mimeType = (
    imageResponse.headers.get("content-type") || guessMimeFromUrl(input.imageUrl)
  )
    .split(";")[0]
    ?.trim()
    .toLowerCase();
  if (!mimeType || !isAllowedImageMime(mimeType)) {
    throw new Error("La foto de fachada no es un formato de imagen válido");
  }

  const buffer = Buffer.from(await imageResponse.arrayBuffer());
  if (buffer.byteLength <= 0 || buffer.byteLength > IMAGE_MAX_BYTES) {
    throw new Error("La foto de fachada supera el tamaño permitido");
  }

  const extension = mimeType.includes("png")
    ? "png"
    : mimeType.includes("webp")
      ? "webp"
      : "jpg";

  const uploadForm = new FormData();
  uploadForm.append("messaging_product", "whatsapp");
  uploadForm.append("type", mimeType);
  uploadForm.append(
    "file",
    new Blob([new Uint8Array(buffer)], { type: mimeType }),
    `fachada.${extension}`,
  );

  const phoneNumberId = getServerEnv("WHATSAPP_PHONE_NUMBER_ID");
  const token = getServerEnv("WHATSAPP_TOKEN");

  const uploadResponse = await fetch(
    `https://graph.facebook.com/${GRAPH_API_VERSION}/${phoneNumberId}/media`,
    {
      method: "POST",
      headers: { Authorization: `Bearer ${token}` },
      body: uploadForm,
    },
  );
  const uploadData = (await uploadResponse.json()) as {
    id?: string;
    error?: { message?: string };
  };
  if (!uploadResponse.ok || !uploadData.id) {
    throw new Error(uploadData.error?.message || "No se subió la foto a WhatsApp");
  }

  const sendResponse = await fetch(
    `https://graph.facebook.com/${GRAPH_API_VERSION}/${phoneNumberId}/messages`,
    {
      method: "POST",
      headers: {
        Authorization: `Bearer ${token}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        messaging_product: "whatsapp",
        recipient_type: "individual",
        to,
        type: "image",
        image: {
          id: uploadData.id,
          caption: input.caption.slice(0, 1024),
        },
      }),
    },
  );
  const sendData = (await sendResponse.json()) as {
    messages?: Array<{ id?: string }>;
    error?: { message?: string };
  };
  if (!sendResponse.ok || sendData.error) {
    throw new Error(sendData.error?.message || "Error al enviar la foto por WhatsApp");
  }

  const waMessageId = String(sendData.messages?.[0]?.id || "") || null;
  await persistOutbound(input.supabase, {
    conversationId: input.conversationId,
    waMessageId,
    content: input.caption,
    mediaUrl: input.imageUrl,
    mediaType: "image",
    metadata: input.metadata,
  });
  return waMessageId;
};
