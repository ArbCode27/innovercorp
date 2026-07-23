import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";

const VERIFY_TOKEN = process.env.WHATSAPP_VERIFY_TOKEN!;
const MAKE_WEBHOOK_URL = process.env.MAKE_WEBHOOK_URL;
const GRAPH_API_VERSION = "v19.0";
const DEFAULT_STORAGE_BUCKET = "whatsapp-media";

const DEFAULT_CLIENT_COLOR = "#4f8ef7";
const DEFAULT_CLIENT_BG = "rgba(79,142,247,.15)";
const WEBHOOK_LOG_PREFIX = "[WHATSAPP_WEBHOOK]";

type SupportedIncomingMessageType =
  | "text"
  | "image"
  | "audio"
  | "video"
  | "document"
  | "location";

type IncomingPayload = {
  messageId: string;
  messageType: SupportedIncomingMessageType;
  from: string;
  content: string;
  preview: string;
  waName: string | null;
  mediaId: string | null;
  mediaType: "audio" | "image" | "video" | "document" | "location" | null;
  mimeType: string | null;
  caption: string | null;
  metadata: Record<string, unknown> | null;
  latitude: number | null;
  longitude: number | null;
  locationName: string | null;
  locationAddress: string | null;
  timestamp: string;
  phoneNumberId: string | null;
};

const normalizePhone = (value: string) => value.replace(/\D/g, "");

const maskPhone = (value: string) => {
  if (value.length <= 4) return value;
  return `${"*".repeat(Math.max(0, value.length - 4))}${value.slice(-4)}`;
};

const getServerEnv = (key: string) => {
  const value = process.env[key];
  if (!value) {
    throw new Error(`Missing environment variable: ${key}`);
  }
  return value;
};

const parseWhatsappTimestamp = (value: unknown) => {
  const parsedTimestamp = Number(value);
  return Number.isFinite(parsedTimestamp)
    ? new Date(parsedTimestamp * 1000).toISOString()
    : new Date().toISOString();
};

const getInitials = (name: string) => {
  const initials = name
    .trim()
    .split(/\s+/)
    .map((part) => part[0])
    .join("")
    .slice(0, 2)
    .toUpperCase();

  return initials || "??";
};

const getSupabaseServerClient = () =>
  createClient(
    getServerEnv("NEXT_PUBLIC_SUPABASE_URL"),
    getServerEnv("SUPABASE_SERVICE_ROLE_KEY"),
  );

const sanitizePathSegment = (value: string) =>
  value
    .toLowerCase()
    .replace(/[^a-z0-9._-]/g, "-")
    .replace(/-+/g, "-")
    .replace(/^-|-$/g, "");

const inferExtensionFromMime = (mimeType: string | null, fallback = "bin") => {
  const normalizedMimeType = (mimeType || "").toLowerCase();
  if (!normalizedMimeType.includes("/")) return fallback;
  const [, subtype] = normalizedMimeType.split("/");
  if (!subtype) return fallback;
  return subtype.split(";")[0].replace(/[^a-z0-9]/g, "") || fallback;
};

const resolveMediaBucket = (messageType: SupportedIncomingMessageType) => {
  const legacy = process.env.SUPABASE_WHATSAPP_MEDIA_BUCKET;
  switch (messageType) {
    case "audio":
      return process.env.SUPABASE_WHATSAPP_AUDIO_BUCKET || legacy || DEFAULT_STORAGE_BUCKET;
    case "image":
      return process.env.SUPABASE_WHATSAPP_IMAGE_BUCKET || legacy || DEFAULT_STORAGE_BUCKET;
    case "video":
      return process.env.SUPABASE_WHATSAPP_VIDEO_BUCKET || legacy || DEFAULT_STORAGE_BUCKET;
    case "document":
      return process.env.SUPABASE_WHATSAPP_DOCUMENT_BUCKET || legacy || DEFAULT_STORAGE_BUCKET;
    default:
      return legacy || DEFAULT_STORAGE_BUCKET;
  }
};

const fetchWhatsappMediaDownloadUrl = async (mediaId: string) => {
  const whatsappToken = getServerEnv("WHATSAPP_TOKEN");
  const mediaResponse = await fetch(
    `https://graph.facebook.com/${GRAPH_API_VERSION}/${mediaId}`,
    {
      method: "GET",
      headers: {
        Authorization: `Bearer ${whatsappToken}`,
      },
    },
  );

  const mediaData = await mediaResponse.json();
  if (!mediaResponse.ok || mediaData.error || !mediaData.url) {
    throw new Error(
      mediaData.error?.message || "No se pudo obtener la URL de descarga del archivo",
    );
  }

  return {
    downloadUrl: mediaData.url as string,
    mimeType: (mediaData.mime_type as string | undefined) || null,
  };
};

const downloadWhatsappMedia = async (downloadUrl: string) => {
  const whatsappToken = getServerEnv("WHATSAPP_TOKEN");
  const fileResponse = await fetch(downloadUrl, {
    method: "GET",
    headers: {
      Authorization: `Bearer ${whatsappToken}`,
    },
  });

  if (!fileResponse.ok) {
    throw new Error("No se pudo descargar el archivo multimedia desde WhatsApp");
  }

  const contentType = fileResponse.headers.get("content-type");
  const buffer = Buffer.from(await fileResponse.arrayBuffer());
  return { buffer, contentType };
};

const storeIncomingMedia = async (
  supabase: ReturnType<typeof getSupabaseServerClient>,
  input: {
    conversationId: number;
    messageType: SupportedIncomingMessageType;
    mediaId: string;
    mimeType: string | null;
    originalFilename?: string | null;
  },
) => {
  const mediaInfo = await fetchWhatsappMediaDownloadUrl(input.mediaId);
  const { buffer, contentType } = await downloadWhatsappMedia(mediaInfo.downloadUrl);
  const resolvedMimeType =
    input.mimeType || mediaInfo.mimeType || contentType || "application/octet-stream";
  const extension = inferExtensionFromMime(resolvedMimeType, "bin");
  const mediaFolder =
    input.messageType === "image"
      ? "images"
      : input.messageType === "audio"
        ? "audio"
        : input.messageType === "video"
          ? "videos"
          : "documents";

  const safeOriginalFilename = sanitizePathSegment(input.originalFilename || "");
  const filename = safeOriginalFilename
    ? `${Date.now()}-${safeOriginalFilename}`
    : `${Date.now()}-${input.mediaId}.${extension}`;
  const storagePath = `${mediaFolder}/${input.conversationId}/${filename}`;

  const bucket = resolveMediaBucket(input.messageType);
  const { error: storageError } = await supabase.storage
    .from(bucket)
    .upload(storagePath, buffer, {
      contentType: resolvedMimeType,
      upsert: false,
    });

  if (storageError) throw storageError;

  const {
    data: { publicUrl },
  } = supabase.storage.from(bucket).getPublicUrl(storagePath);

  return {
    publicUrl,
    mimeType: resolvedMimeType,
    storagePath,
    bucket,
    sizeBytes: buffer.byteLength,
  };
};

const findOrCreateClient = async (
  supabase: ReturnType<typeof getSupabaseServerClient>,
  from: string,
  waName: string | null,
) => {
  const { data: byWhatsappId, error: byWhatsappIdError } = await supabase
    .from("clients")
    .select("*")
    .eq("whatsapp_id", from)
    .limit(1)
    .maybeSingle();

  if (byWhatsappIdError) throw byWhatsappIdError;
  if (byWhatsappId) {
    console.log(`${WEBHOOK_LOG_PREFIX} client_found_by_whatsapp_id`, {
      clientId: byWhatsappId.id,
      from: maskPhone(from),
    });
    return byWhatsappId;
  }

  const { data: byPhone, error: byPhoneError } = await supabase
    .from("clients")
    .select("*")
    .eq("phone", from)
    .limit(1)
    .maybeSingle();

  if (byPhoneError) throw byPhoneError;
  if (byPhone) {
    const { data: updatedClient, error: updateClientError } = await supabase
      .from("clients")
      .update({
        whatsapp_id: byPhone.whatsapp_id || from,
        wa_name: byPhone.wa_name || waName,
      })
      .eq("id", byPhone.id)
      .select("*")
      .single();

    if (updateClientError) throw updateClientError;
    console.log(`${WEBHOOK_LOG_PREFIX} client_found_by_phone_and_updated`, {
      clientId: updatedClient.id,
      from: maskPhone(from),
    });
    return updatedClient;
  }

  const safeName = (waName || "").trim() || "Número desconocido";
  const { data: createdClient, error: createClientError } = await supabase
    .from("clients")
    .insert({
      name: safeName,
      phone: from,
      whatsapp_id: from,
      wa_name: waName,
      account: "Prospecto",
      plan: null,
      zone: null,
      color: DEFAULT_CLIENT_COLOR,
      bg: DEFAULT_CLIENT_BG,
      initials: getInitials(safeName),
      created_at: new Date().toISOString(),
    })
    .select("*")
    .single();

  if (createClientError) throw createClientError;
  console.log(`${WEBHOOK_LOG_PREFIX} client_created`, {
    clientId: createdClient.id,
    from: maskPhone(from),
  });
  return createdClient;
};

const findOrCreateActiveConversation = async (
  supabase: ReturnType<typeof getSupabaseServerClient>,
  clientId: number,
  messageTimestamp: string,
  phoneNumberId: string | null,
) => {
  const { data: existingConversation, error: existingConversationError } =
    await supabase
      .from("conversations")
      .select("*")
      .eq("client_id", clientId)
      .in("status", ["abierto", "proceso"])
      .order("updated_at", { ascending: false })
      .limit(1)
      .maybeSingle();

  if (existingConversationError) throw existingConversationError;
  if (existingConversation) {
    console.log(`${WEBHOOK_LOG_PREFIX} active_conversation_found`, {
      conversationId: existingConversation.id,
      clientId,
      status: existingConversation.status,
    });
    return existingConversation;
  }

  const { data: createdConversation, error: createConversationError } =
    await supabase
      .from("conversations")
      .insert({
        client_id: clientId,
        status: "abierto",
        human_mode: false,
        unread: 0,
        preview: null,
        label_ids: [],
        agent_id: null,
        agent_control: null,
        wa_phone_number_id: phoneNumberId,
        last_message_at: messageTimestamp,
        updated_at: messageTimestamp,
        created_at: messageTimestamp,
      })
      .select("*")
      .single();

  if (createConversationError) throw createConversationError;
  console.log(`${WEBHOOK_LOG_PREFIX} active_conversation_created`, {
    conversationId: createdConversation.id,
    clientId,
    status: createdConversation.status,
  });
  return createdConversation;
};

const upsertIncomingMessage = async (
  supabase: ReturnType<typeof getSupabaseServerClient>,
  payload: IncomingPayload,
) => {
  const {
    messageId,
    messageType,
    from,
    content,
    preview,
    waName,
    mediaId,
    mediaType,
    mimeType,
    caption,
    metadata,
    latitude,
    longitude,
    locationName,
    locationAddress,
    timestamp,
    phoneNumberId,
  } = payload;

  const { data: existingMessage, error: existingMessageError } = await supabase
    .from("messages")
    .select("id")
    .eq("wa_message_id", messageId)
    .limit(1)
    .maybeSingle();

  if (existingMessageError) throw existingMessageError;
  if (existingMessage) {
    console.log(`${WEBHOOK_LOG_PREFIX} duplicate_message_ignored`, {
      messageId,
      messageType,
    });
    return {
      ignored: true as const,
      reason: "duplicate_before_processing",
      messageType,
      messageId,
      clientId: null as number | null,
      conversationId: null as number | null,
      dbMessageId: null as number | null,
      humanMode: null as boolean | null,
    };
  }

  const client = await findOrCreateClient(supabase, from, waName);
  const conversation = await findOrCreateActiveConversation(
    supabase,
    client.id,
    timestamp,
    phoneNumberId,
  );

  let persistedMediaUrl: string | null = null;
  let persistedMimeType: string | null = mimeType;
  let mergedMetadata: Record<string, unknown> | null = metadata;

  if (
    mediaId &&
    mediaType &&
    ["audio", "image", "video", "document"].includes(mediaType)
  ) {
    const originalFilename =
      typeof metadata?.filename === "string" ? String(metadata.filename) : null;
    const storedMedia = await storeIncomingMedia(supabase, {
      conversationId: conversation.id,
      messageType,
      mediaId,
      mimeType,
      originalFilename,
    });

    persistedMediaUrl = storedMedia.publicUrl;
    persistedMimeType = storedMedia.mimeType;
    mergedMetadata = {
      ...(metadata || {}),
      media_id: mediaId,
      storage_path: storedMedia.storagePath,
      storage_bucket: storedMedia.bucket,
      size_bytes: storedMedia.sizeBytes,
    };
  }

  const { data: insertedMessage, error: insertMessageError } = await supabase
    .from("messages")
    .insert({
      conversation_id: conversation.id,
      wa_message_id: messageId,
      type: "in",
      content,
      sender_type: "client",
      sent_by: waName,
      status: "delivered",
      media_url: persistedMediaUrl,
      media_type: mediaType,
      mime_type: persistedMimeType,
      caption,
      metadata: mergedMetadata,
      latitude,
      longitude,
      location_name: locationName,
      location_address: locationAddress,
      created_at: timestamp,
    })
    .select("id, conversation_id, wa_message_id")
    .single();

  if (insertMessageError) {
    const duplicateMessage =
      insertMessageError &&
      typeof insertMessageError === "object" &&
      "code" in insertMessageError &&
      String((insertMessageError as { code?: string }).code) === "23505";

    if (!duplicateMessage) throw insertMessageError;
    return {
      ignored: true as const,
      reason: "duplicate_on_insert",
      messageType,
      messageId,
      clientId: client.id,
      conversationId: conversation.id,
      dbMessageId: null as number | null,
      humanMode: Boolean(conversation.human_mode),
    };
  }
  console.log(`${WEBHOOK_LOG_PREFIX} message_inserted`, {
    messageId: insertedMessage?.id,
    waMessageId: insertedMessage?.wa_message_id,
    conversationId: insertedMessage?.conversation_id,
    messageType,
  });

  const expectedUnread = (conversation.unread ?? 0) + 1;
  const { data: updatedConversation, error: updateConversationError } = await supabase
    .from("conversations")
    .update({
      preview,
      unread: expectedUnread,
      updated_at: timestamp,
      last_message_at: timestamp,
      wa_phone_number_id: phoneNumberId,
    })
    .eq("id", conversation.id)
    .select("id, unread, preview, updated_at, last_message_at")
    .single();

  if (updateConversationError) throw updateConversationError;
  console.log(`${WEBHOOK_LOG_PREFIX} conversation_updated_after_message`, {
    conversationId: updatedConversation?.id,
    unread: updatedConversation?.unread,
    expectedUnread,
    preview: updatedConversation?.preview,
    updatedAt: updatedConversation?.updated_at,
    lastMessageAt: updatedConversation?.last_message_at,
  });

  console.log(`${WEBHOOK_LOG_PREFIX} message_saved`, {
    messageId,
    messageType,
    clientId: client.id,
    conversationId: conversation.id,
    mediaType,
    hasMediaUrl: Boolean(persistedMediaUrl),
    preview,
  });

  return {
    ignored: false as const,
    reason: "saved",
    messageType,
    messageId,
    clientId: client.id,
    conversationId: conversation.id,
    dbMessageId: insertedMessage?.id ?? null,
    humanMode: Boolean(conversation.human_mode),
  };
};

export async function GET(req: NextRequest) {
  const { searchParams } = new URL(req.url);
  const mode = searchParams.get("hub.mode");
  const token = searchParams.get("hub.verify_token");
  const challenge = searchParams.get("hub.challenge");

  if (mode === "subscribe" && token === VERIFY_TOKEN) {
    console.log("✅ Webhook verificado por Meta");
    return new NextResponse(challenge, { status: 200 });
  }
  return new NextResponse("Forbidden", { status: 403 });
}

export async function POST(req: NextRequest) {
  const requestSummary: {
    eventType: "message" | "status_update" | "unrecognized" | "invalid";
    messageType: string | null;
    messageId: string | null;
    saved: boolean;
    ignored: boolean;
    reason: string | null;
    clientId: number | null;
    conversationId: number | null;
    dbMessageId: number | null;
    humanMode: boolean | null;
    status: string | null;
  } = {
    eventType: "invalid",
    messageType: null,
    messageId: null,
    saved: false,
    ignored: false,
    reason: null,
    clientId: null,
    conversationId: null,
    dbMessageId: null,
    humanMode: null,
    status: null,
  };

  try {
    console.log(`${WEBHOOK_LOG_PREFIX} request_received`, {
      method: req.method,
      url: req.url,
    });

    const supabase = getSupabaseServerClient();
    const rawBody = await req.json();

    // Extraer el valor principal
    const entry = rawBody?.entry?.[0];
    const changes = entry?.changes?.[0];
    const value = changes?.value;

    if (!value) {
      requestSummary.eventType = "invalid";
      requestSummary.ignored = true;
      requestSummary.reason = "payload_without_value";
      console.log(`${WEBHOOK_LOG_PREFIX} payload_without_value_ignored`, {
        hasEntry: Boolean(entry),
        hasChanges: Boolean(changes),
      });
      return new NextResponse("OK", { status: 200 });
    }

    console.log(`${WEBHOOK_LOG_PREFIX} payload_received`, {
      hasMessages: Boolean(value.messages?.length),
      hasStatuses: Boolean(value.statuses?.length),
      phoneNumberId: value.metadata?.phone_number_id || null,
    });

    // ── CASO 1: Mensaje entrante ──────────────────────────
    if (value.messages && value.messages.length > 0) {
      requestSummary.eventType = "message";
      const message = value.messages[0];
      const contact = value.contacts?.[0];
      const metadata = value.metadata;
      const normalizedFrom = normalizePhone(message.from || "");
      const messageId = String(message.id || "").trim();
      const messageType = String(message.type || "").trim() as SupportedIncomingMessageType;
      requestSummary.messageType = messageType || null;
      requestSummary.messageId = messageId || null;
      const waName = contact?.profile?.name || null;
      const timestamp = parseWhatsappTimestamp(message.timestamp);

      console.log(`${WEBHOOK_LOG_PREFIX} incoming_message_received`, {
        messageId,
        messageType,
        from: maskPhone(normalizedFrom),
        waName,
        timestamp,
        phoneNumberId: metadata?.phone_number_id || null,
      });

      if (!normalizedFrom || !messageId) {
        requestSummary.ignored = true;
        requestSummary.reason = "invalid_message_payload";
        console.log(`${WEBHOOK_LOG_PREFIX} invalid_message_ignored`, {
          hasFrom: Boolean(normalizedFrom),
          hasMessageId: Boolean(messageId),
          rawType: message.type,
        });
        return new NextResponse("OK", { status: 200 });
      }

      const isSupportedType = [
        "text",
        "image",
        "audio",
        "video",
        "document",
        "location",
      ].includes(messageType);
      if (!isSupportedType) {
        requestSummary.ignored = true;
        requestSummary.reason = "unsupported_type";
        console.log(`${WEBHOOK_LOG_PREFIX} unsupported_type_ignored`, {
          messageId,
          messageType,
        });
        return new NextResponse("OK", { status: 200 });
      }

      let content = "";
      let preview = "";
      let mediaId: string | null = null;
      let mediaType: IncomingPayload["mediaType"] = null;
      let mimeType: string | null = null;
      let caption: string | null = null;
      let incomingMetadata: Record<string, unknown> | null = null;
      let latitude: number | null = null;
      let longitude: number | null = null;
      let locationName: string | null = null;
      let locationAddress: string | null = null;

      if (messageType === "text") {
        const body = String(message.text?.body || "").trim();
        content = body;
        preview = body;
      } else if (messageType === "image") {
        mediaId = String(message.image?.id || "").trim() || null;
        caption = String(message.image?.caption || "").trim() || null;
        mimeType = String(message.image?.mime_type || "").trim() || null;
        mediaType = "image";
        content = caption || "Imagen";
        preview = content;
      } else if (messageType === "audio") {
        mediaId = String(message.audio?.id || "").trim() || null;
        mimeType = String(message.audio?.mime_type || "").trim() || null;
        mediaType = "audio";
        content = "Audio";
        preview = "Audio";
      } else if (messageType === "video") {
        mediaId = String(message.video?.id || "").trim() || null;
        caption = String(message.video?.caption || "").trim() || null;
        mimeType = String(message.video?.mime_type || "").trim() || null;
        mediaType = "video";
        content = caption || "Video";
        preview = content;
      } else if (messageType === "document") {
        mediaId = String(message.document?.id || "").trim() || null;
        caption = String(message.document?.caption || "").trim() || null;
        const filename = String(message.document?.filename || "").trim() || null;
        mimeType = String(message.document?.mime_type || "").trim() || null;
        mediaType = "document";
        incomingMetadata = filename ? { filename } : null;
        content = caption || filename || "Documento";
        preview = content;
      } else if (messageType === "location") {
        mediaType = "location";
        latitude =
          typeof message.location?.latitude === "number"
            ? message.location.latitude
            : null;
        longitude =
          typeof message.location?.longitude === "number"
            ? message.location.longitude
            : null;
        locationName = String(message.location?.name || "").trim() || null;
        locationAddress = String(message.location?.address || "").trim() || null;
        content = locationName || locationAddress || "Ubicación compartida";
        preview = "Ubicación compartida";
      }

      if (!content.trim()) {
        requestSummary.ignored = true;
        requestSummary.reason = "empty_content";
        console.log(`${WEBHOOK_LOG_PREFIX} empty_content_ignored`, {
          messageId,
          messageType,
        });
        return new NextResponse("OK", { status: 200 });
      }

      if (
        ["image", "audio", "video", "document"].includes(messageType) &&
        !mediaId
      ) {
        requestSummary.ignored = true;
        requestSummary.reason = "missing_media_id";
        console.log(`${WEBHOOK_LOG_PREFIX} missing_media_id_ignored`, {
          messageId,
          messageType,
        });
        return new NextResponse("OK", { status: 200 });
      }

      const messageResult = await upsertIncomingMessage(supabase, {
        messageId,
        messageType,
        from: normalizedFrom,
        content: content.trim(),
        preview: (preview || content).trim(),
        waName,
        mediaId,
        mediaType,
        mimeType,
        caption,
        metadata: incomingMetadata,
        latitude,
        longitude,
        locationName,
        locationAddress,
        timestamp,
        phoneNumberId: metadata?.phone_number_id || null,
      });

      requestSummary.messageType = messageResult.messageType;
      requestSummary.messageId = messageResult.messageId;
      requestSummary.reason = messageResult.reason;
      requestSummary.clientId = messageResult.clientId;
      requestSummary.conversationId = messageResult.conversationId;
      requestSummary.dbMessageId = messageResult.dbMessageId;
      requestSummary.humanMode = messageResult.humanMode;
      requestSummary.ignored = messageResult.ignored;
      requestSummary.saved = !messageResult.ignored;

      if (MAKE_WEBHOOK_URL) {
        const makePayload = {
          event_type: "message",
          wa_message_id: messageId,
          message_type: messageType,
          from: normalizedFrom,
          wa_name: waName,
          content: content.trim(),
          preview: (preview || content).trim(),
          media_id: mediaId,
          media_url: null,
          media_type: mediaType,
          mime_type: mimeType,
          caption,
          latitude,
          longitude,
          location_name: locationName,
          location_address: locationAddress,
          timestamp,
          phone_number_id: metadata?.phone_number_id || null,
          client_id: messageResult.clientId,
          conversation_id: messageResult.conversationId,
          message_id: messageResult.dbMessageId,
          human_mode: messageResult.humanMode,
          saved: !messageResult.ignored,
          ignored: messageResult.ignored,
          reason: messageResult.reason,
        };

        await fetch(MAKE_WEBHOOK_URL, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify(makePayload),
        });
      }
    }

    // ── CASO 2: Status update (delivered/read/failed) ─────
    else if (value.statuses && value.statuses.length > 0) {
      requestSummary.eventType = "status_update";
      const status = value.statuses[0];

      const waMessageId = String(status.id || "").trim();
      const nextStatus = String(status.status || "").trim();
      requestSummary.messageId = waMessageId || null;
      requestSummary.status = nextStatus || null;
      requestSummary.messageType = "status_update";

      console.log(`${WEBHOOK_LOG_PREFIX} status_update_received`, {
        waMessageId,
        nextStatus,
        recipientId: status.recipient_id || null,
      });

      if (
        waMessageId &&
        ["sent", "delivered", "read", "failed"].includes(nextStatus)
      ) {
        const { error: statusUpdateError } = await supabase
          .from("messages")
          .update({ status: nextStatus })
          .eq("wa_message_id", waMessageId);

        if (statusUpdateError) {
          console.error(`${WEBHOOK_LOG_PREFIX} status_update_failed`, statusUpdateError);
          requestSummary.saved = false;
          requestSummary.reason = "status_update_failed";
        } else {
          console.log(`${WEBHOOK_LOG_PREFIX} status_update_saved`, {
            waMessageId,
            nextStatus,
          });
          requestSummary.saved = true;
          requestSummary.reason = "status_update_saved";
        }
      }

      if (MAKE_WEBHOOK_URL) {
        const makePayload = {
          event_type: "status_update",
          wa_message_id: status.id,
          status: status.status, // sent, delivered, read, failed
          timestamp: status.timestamp,
          recipient_id: status.recipient_id,
        };

        await fetch(MAKE_WEBHOOK_URL, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify(makePayload),
        });
      }
    } else {
      requestSummary.eventType = "unrecognized";
      requestSummary.ignored = true;
      requestSummary.reason = "unrecognized_event";
      console.log(`${WEBHOOK_LOG_PREFIX} unrecognized_event_ignored`);
    }

    console.log(`${WEBHOOK_LOG_PREFIX} request_completed`, requestSummary);
    return new NextResponse("OK", { status: 200 });
  } catch (error) {
    console.error(`${WEBHOOK_LOG_PREFIX} request_summary_on_error`, requestSummary);
    console.error(`${WEBHOOK_LOG_PREFIX} request_failed`, error);
    return new NextResponse("Error", { status: 500 });
  }
}
