import { formatLocationForAi } from "@/lib/location-message";
import type { SupabaseClient } from "@supabase/supabase-js";
import type { AiContent, AiContentPart } from "./ai-client";
import { describeImageWithGroq, transcribeAudioWithGroq } from "./ai-client";
import { getLatestInboundMessage } from "./inbound-intent";

const LOG_PREFIX = "[AI_AGENT]";

const IMAGE_MAX_BYTES = 6 * 1024 * 1024;
const AUDIO_MAX_BYTES = 12 * 1024 * 1024;
const MAX_INLINE_ATTACHMENTS = 3;
const RECENT_WINDOW_MS = 3 * 60 * 1000;

const ALLOWED_IMAGE_MIME = new Set([
  "image/jpeg",
  "image/jpg",
  "image/png",
  "image/webp",
  "image/gif",
]);

const ALLOWED_AUDIO_MIME = new Set([
  "audio/ogg",
  "audio/mpeg",
  "audio/mp3",
  "audio/mp4",
  "audio/wav",
  "audio/webm",
  "audio/aac",
  "audio/opus",
]);

export type AgentHistoryMessage = {
  id: number;
  type: string | null;
  content: string | null;
  sender_type: string | null;
  created_at: string | null;
  media_url?: string | null;
  media_type?: string | null;
  mime_type?: string | null;
  caption?: string | null;
  metadata?: Record<string, unknown> | null;
  latitude?: number | null;
  longitude?: number | null;
  location_name?: string | null;
  location_address?: string | null;
};

const isUserMessage = (message: AgentHistoryMessage) =>
  message.type === "in" || message.sender_type === "client";

const normalizeMime = (mimeType: string | null | undefined) =>
  (mimeType || "").toLowerCase().split(";")[0]?.trim() || "";

const resolveMimeForMedia = (message: AgentHistoryMessage) => {
  const mime = normalizeMime(message.mime_type);
  if (mime && mime !== "application/octet-stream") return mime;

  if (message.media_type === "image") return "image/jpeg";
  if (message.media_type === "audio") return "audio/ogg";
  return mime;
};

const isAttachableMedia = (message: AgentHistoryMessage) => {
  if (!isUserMessage(message) || !message.media_url) return false;
  const mediaType = (message.media_type || "").toLowerCase();
  return mediaType === "image" || mediaType === "audio";
};

export const formatMessageTextForHistory = (message: AgentHistoryMessage) => {
  const content = String(message.content || "").trim();
  const caption = String(message.caption || "").trim();
  const mediaType = (message.media_type || "").toLowerCase();
  const transcript =
    typeof message.metadata?.transcript === "string"
      ? message.metadata.transcript.trim()
      : "";
  const summary =
    typeof message.metadata?.media_summary === "string"
      ? message.metadata.media_summary.trim()
      : typeof message.metadata?.media_summary === "string"
        ? message.metadata.media_summary.trim()
        : "";

  if (mediaType === "image") {
    const bits = ["[Imagen]"];
    if (caption) bits.push(`caption: ${caption}`);
    else if (content && content.toLowerCase() !== "imagen") {
      bits.push(content);
    }
    if (summary) bits.push(`análisis previo: ${summary}`);
    return bits.join(" ");
  }

  if (mediaType === "audio") {
    const bits = ["[Audio]"];
    if (transcript) bits.push(`transcripción: ${transcript}`);
    else if (content && content.toLowerCase() !== "audio") {
      bits.push(content);
    } else {
      bits.push("nota de voz del cliente");
    }
    if (summary) bits.push(`resumen: ${summary}`);
    return bits.join(" ");
  }

  if (mediaType === "video") {
    return `[Video] ${caption || content || "video recibido"}`;
  }

  if (mediaType === "document") {
    return `[Documento] ${caption || content || "documento recibido"}`;
  }

  if (mediaType === "location" || content.toLowerCase().includes("ubicación")) {
    return formatLocationForAi(message);
  }

  return content;
};

const downloadMediaBytes = async (
  message: AgentHistoryMessage,
): Promise<{ buffer: Buffer; mimeType: string } | null> => {
  const mediaType = (message.media_type || "").toLowerCase();
  const mimeType = resolveMimeForMedia(message);
  const maxBytes = mediaType === "audio" ? AUDIO_MAX_BYTES : IMAGE_MAX_BYTES;

  if (mediaType === "image" && !ALLOWED_IMAGE_MIME.has(mimeType)) {
    console.warn(`${LOG_PREFIX} unsupported_image_mime`, {
      messageId: message.id,
      mimeType,
    });
    return null;
  }

  if (mediaType === "audio" && !ALLOWED_AUDIO_MIME.has(mimeType)) {
    console.warn(`${LOG_PREFIX} unsupported_audio_mime`, {
      messageId: message.id,
      mimeType,
    });
    return null;
  }

  if (!message.media_url) return null;

  try {
    const response = await fetch(message.media_url, {
      method: "GET",
      cache: "no-store",
      signal: AbortSignal.timeout(20_000),
    });

    if (!response.ok) {
      console.warn(`${LOG_PREFIX} download_failed`, {
        messageId: message.id,
        status: response.status,
      });
      return null;
    }

    const buffer = Buffer.from(await response.arrayBuffer());
    if (!buffer.length) {
      console.warn(`${LOG_PREFIX} empty_file`, { messageId: message.id });
      return null;
    }

    if (buffer.byteLength > maxBytes) {
      console.warn(`${LOG_PREFIX} file_too_large`, {
        messageId: message.id,
        bytes: buffer.byteLength,
        maxBytes,
        mediaType,
      });
      return null;
    }

    const resolvedMime =
      normalizeMime(response.headers.get("content-type")) || mimeType;

    console.log(`${LOG_PREFIX} downloaded`, {
      messageId: message.id,
      mediaType,
      mimeType: resolvedMime,
      bytes: buffer.byteLength,
    });

    return { buffer, mimeType: resolvedMime };
  } catch (error) {
    console.warn(`${LOG_PREFIX} download_error`, {
      messageId: message.id,
      error: error instanceof Error ? error.message : "unknown_error",
    });
    return null;
  }
};

/**
 * gpt-oss-20b is text-only: convert recent image/audio into text via
 * vision / Whisper, then inject into the user turn.
 */
const enrichMediaAsText = async (
  message: AgentHistoryMessage,
): Promise<string | null> => {
  const mediaType = (message.media_type || "").toLowerCase();

  if (mediaType === "audio") {
    const existing =
      typeof message.metadata?.transcript === "string"
        ? message.metadata.transcript.trim()
        : "";
    if (existing) {
      return `[Audio] transcripción: ${existing}`;
    }

    const downloaded = await downloadMediaBytes(message);
    if (!downloaded) return null;

    const transcript = await transcribeAudioWithGroq({
      bytes: downloaded.buffer,
      mimeType: downloaded.mimeType,
    });
    if (!transcript) return null;
    console.log(`${LOG_PREFIX} whisper_ok`, {
      messageId: message.id,
      preview: transcript.slice(0, 120),
    });
    message.metadata = {
      ...(message.metadata || {}),
      transcript,
    };
    return `[Audio] transcripción: ${transcript}`;
  }

  if (mediaType === "image") {
    const existing =
      typeof message.metadata?.media_summary === "string"
        ? message.metadata.media_summary.trim()
        : "";
    if (existing) {
      return `[Imagen] análisis: ${existing}`;
    }

    const downloaded = await downloadMediaBytes(message);
    if (!downloaded) return null;

    const analysis = await describeImageWithGroq({
      base64: downloaded.buffer.toString("base64"),
      mimeType: downloaded.mimeType,
      caption: message.caption,
    });
    if (!analysis) return null;
    console.log(`${LOG_PREFIX} vision_ok`, {
      messageId: message.id,
      preview: analysis.slice(0, 120),
    });
    message.metadata = {
      ...(message.metadata || {}),
      media_summary: analysis,
    };
    return `[Imagen] análisis: ${analysis}`;
  }

  return null;
};

const selectMessagesForInlineMedia = (
  messages: AgentHistoryMessage[],
  triggerMessageId?: number | null,
) => {
  const trigger = triggerMessageId
    ? messages.find((message) => message.id === triggerMessageId)
    : null;
  const anchorTime = trigger?.created_at
    ? Date.parse(trigger.created_at)
    : Date.parse(messages[messages.length - 1]?.created_at || "") || Date.now();

  const latestInbound = getLatestInboundMessage(messages);

  const candidates = messages.filter((message) => {
    if (!isAttachableMedia(message)) return false;
    if (triggerMessageId && message.id === triggerMessageId) return true;
    if (latestInbound && message.id === latestInbound.id) return true;

    const createdAt = message.created_at ? Date.parse(message.created_at) : NaN;
    if (!Number.isFinite(createdAt)) return false;
    return Math.abs(anchorTime - createdAt) <= RECENT_WINDOW_MS;
  });

  candidates.sort((left, right) => {
    if (triggerMessageId) {
      if (left.id === triggerMessageId) return -1;
      if (right.id === triggerMessageId) return 1;
    }
    return (right.id || 0) - (left.id || 0);
  });

  const unique = new Map<number, AgentHistoryMessage>();
  for (const message of candidates) {
    if (unique.size >= MAX_INLINE_ATTACHMENTS) break;
    unique.set(message.id, message);
  }

  return [...unique.values()];
};

/**
 * Builds agent contents: text history + media enriched as text (Whisper/vision).
 */
export const buildAgentContents = async (input: {
  messages: AgentHistoryMessage[];
  triggerMessageId?: number | null;
  supabase?: SupabaseClient;
}): Promise<{
  contents: AiContent[];
  attachedMediaIds: number[];
  transcriptsByMessageId: Map<number, string>;
}> => {
  const inlineTargets = selectMessagesForInlineMedia(
    input.messages,
    input.triggerMessageId,
  );
  const inlineTargetIds = new Set(inlineTargets.map((message) => message.id));

  const mediaTextByMessageId = new Map<number, string>();

  await Promise.all(
    inlineTargets.map(async (message) => {
      const beforeTranscript = message.metadata?.transcript;
      const beforeSummary = message.metadata?.media_summary;
      const enriched = await enrichMediaAsText(message);
      if (enriched) mediaTextByMessageId.set(message.id, enriched);
      const newlyEnriched =
        (message.metadata?.transcript &&
          message.metadata.transcript !== beforeTranscript) ||
        (message.metadata?.media_summary &&
          message.metadata.media_summary !== beforeSummary);
      if (newlyEnriched && input.supabase && message.id) {
        input.supabase
          .from("messages")
          .update({ metadata: message.metadata })
          .eq("id", message.id)
          .then(
            () => {},
            (err) =>
              console.warn(`${LOG_PREFIX} persist_media_metadata_failed`, err),
          );
      }
    }),
  );

  const transcriptsByMessageId = new Map<number, string>();
  for (const message of input.messages) {
    if (
      typeof message.metadata?.transcript === "string" &&
      message.metadata.transcript.trim()
    ) {
      transcriptsByMessageId.set(
        message.id,
        message.metadata.transcript.trim(),
      );
    }
  }

  const contents: AiContent[] = [];

  for (const message of input.messages) {
    const baseText = formatMessageTextForHistory(message);
    const mediaText = mediaTextByMessageId.get(message.id);
    const text =
      mediaText && !baseText.includes(mediaText)
        ? [baseText, mediaText].filter(Boolean).join("\n").trim()
        : baseText || mediaText || "";

    if (!text && !inlineTargetIds.has(message.id)) continue;

    const role = isUserMessage(message) ? ("user" as const) : ("model" as const);
    const parts: AiContentPart[] = [];

    if (text) {
      parts.push({ text });
    } else if (inlineTargetIds.has(message.id)) {
      parts.push({
        text:
          message.media_type === "audio"
            ? "[Audio] nota de voz del cliente (no se pudo transcribir)"
            : "[Imagen] imagen del cliente (no se pudo analizar)",
      });
    }

    if (!parts.length) continue;

    const previous = contents[contents.length - 1];
    if (previous && previous.role === role) {
      previous.parts.push(...parts);
    } else {
      contents.push({ role, parts });
    }
  }

  while (contents.length > 0 && contents[0].role !== "user") {
    contents.shift();
  }

  return {
    contents,
    attachedMediaIds: [...mediaTextByMessageId.keys()],
    transcriptsByMessageId,
  };
};

export const AI_MEDIA_CONTRACT_PROMPT = `Media (imagen/audio/ubicación):
- Las imágenes llegan como texto "[Imagen] análisis: ..." (visión previa). Úsalo como si vieras el comprobante/cédula/fachada.
- Los audios llegan como "[Audio] transcripción: ...". Responde como si fuera texto del cliente.
- Los pines de WhatsApp llegan como "[Ubicación] nombre · dirección · lat, lng · URL de Maps". Eso ES el GPS del ticket: no pidas otra ubicación.
- Usa caption + análisis juntos cuando existan.
- Si el análisis trae cédula legible, puedes usar lookup_wispro_by_cedula.
- Si parece comprobante de pago:
  1) Extrae amount, transaction_code y bank solo si aparecen en el análisis.
  2) Si NO tienes cédula del abonado: PÍDELA. No uses escalate_to_human todavía.
  3) Con cédula: lookup_wispro_by_cedula (con 1 match el sistema vincula ESTE chat) y luego submit_payment_receipt.
  4) Tras submit, el sistema hace handoff; confirma según el resultado. NUNCA digas que el pago está aprobado.
- Si llega ubicación en un caso de soporte: confirma que la recibiste, úsala para la visita y sigue el diagnóstico / escalate_to_human category=support.
- No digas que no puedes ver imágenes, audios o ubicaciones: en este sistema sí los recibes (como texto enriquecido).`;
