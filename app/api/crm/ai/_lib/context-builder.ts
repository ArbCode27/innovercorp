import type { GeminiContent, GeminiContentPart } from "./gemini";

const LOG_PREFIX = "[AI_MEDIA]";

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
    typeof message.metadata?.gemini_media_summary === "string"
      ? message.metadata.gemini_media_summary.trim()
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
    return content || "[Ubicación compartida]";
  }

  return content;
};

const downloadAsInlineData = async (
  message: AgentHistoryMessage,
): Promise<Extract<GeminiContentPart, { inlineData: unknown }> | null> => {
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

    console.log(`${LOG_PREFIX} attached`, {
      messageId: message.id,
      mediaType,
      mimeType: resolvedMime,
      bytes: buffer.byteLength,
    });

    return {
      inlineData: {
        mimeType: resolvedMime,
        data: buffer.toString("base64"),
      },
    };
  } catch (error) {
    console.warn(`${LOG_PREFIX} download_error`, {
      messageId: message.id,
      error: error instanceof Error ? error.message : "unknown_error",
    });
    return null;
  }
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

  const candidates = messages.filter((message) => {
    if (!isAttachableMedia(message)) return false;
    if (triggerMessageId && message.id === triggerMessageId) return true;

    const createdAt = message.created_at ? Date.parse(message.created_at) : NaN;
    if (!Number.isFinite(createdAt)) return false;
    return Math.abs(anchorTime - createdAt) <= RECENT_WINDOW_MS;
  });

  // Prefer trigger first, then newest.
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
 * Builds Gemini contents: text history + inline image/audio for the recent turn.
 */
export const buildAgentContents = async (input: {
  messages: AgentHistoryMessage[];
  triggerMessageId?: number | null;
}): Promise<{
  contents: GeminiContent[];
  attachedMediaIds: number[];
}> => {
  const inlineTargets = selectMessagesForInlineMedia(
    input.messages,
    input.triggerMessageId,
  );
  const inlineTargetIds = new Set(inlineTargets.map((message) => message.id));

  const inlinePartsByMessageId = new Map<
    number,
    Extract<GeminiContentPart, { inlineData: unknown }>
  >();

  await Promise.all(
    inlineTargets.map(async (message) => {
      const part = await downloadAsInlineData(message);
      if (part) inlinePartsByMessageId.set(message.id, part);
    }),
  );

  const contents: GeminiContent[] = [];

  for (const message of input.messages) {
    const text = formatMessageTextForHistory(message);
    if (!text && !inlinePartsByMessageId.has(message.id)) continue;

    const role = isUserMessage(message) ? ("user" as const) : ("model" as const);
    const parts: GeminiContentPart[] = [];

    if (text) {
      parts.push({ text });
    } else if (inlineTargetIds.has(message.id)) {
      parts.push({
        text:
          message.media_type === "audio"
            ? "[Audio] nota de voz del cliente"
            : "[Imagen] imagen del cliente",
      });
    }

    const inlinePart = inlinePartsByMessageId.get(message.id);
    if (inlinePart) {
      parts.push(inlinePart);
    }

    if (!parts.length) continue;

    const previous = contents[contents.length - 1];
    if (previous && previous.role === role) {
      // Merge consecutive same-role turns (Gemini prefers alternating roles,
      // but coalescing user bursts with media is acceptable as one user turn).
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
    attachedMediaIds: [...inlinePartsByMessageId.keys()],
  };
};

export const GEMINI_MEDIA_CONTRACT_PROMPT = `Media (imagen/audio):
- Si el usuario envía una imagen, analízala (comprobante, cédula, falla técnica, captura) y actúa.
- Si envía audio, interpreta el contenido y responde como si fuera texto.
- Usa caption + media juntos cuando existan.
- Si ves una cédula legible en imagen, puedes usar lookup_wispro_by_cedula.
- Si parece comprobante de pago, resume lo que ves (monto/referencia si son legibles) y no inventes datos.
- No digas que no puedes ver imágenes o audios: en este sistema sí los recibes.`;
