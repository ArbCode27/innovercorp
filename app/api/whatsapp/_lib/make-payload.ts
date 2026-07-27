export type MakeMessagePayload = {
  event_type: "message";
  wa_message_id: string;
  message_type: string;
  from: string;
  wa_name: string | null;
  content: string;
  preview: string;
  media_id: string | null;
  media_url: string | null;
  media_type: string | null;
  mime_type: string | null;
  caption: string | null;
  latitude: number | null;
  longitude: number | null;
  location_name: string | null;
  location_address: string | null;
  timestamp: string;
  phone_number_id: string | null;
  client_id: number | null;
  conversation_id: number | null;
  message_id: number | null;
  human_mode: boolean | null;
  saved: boolean;
  ignored: boolean;
  reason: string | null;
};

const normalizePhone = (value: string) => value.replace(/\D/g, "");

export const validateMakeMessagePayload = (payload: MakeMessagePayload) => {
  const errors: string[] = [];

  if (!payload.saved || payload.ignored) {
    errors.push("message_not_saved");
  }

  if (!payload.conversation_id) {
    errors.push("missing_conversation_id");
  }

  if (!payload.client_id) {
    errors.push("missing_client_id");
  }

  if (!payload.message_id) {
    errors.push("missing_message_id");
  }

  if (!payload.wa_message_id?.trim()) {
    errors.push("missing_wa_message_id");
  }

  const normalizedFrom = normalizePhone(payload.from || "");
  if (normalizedFrom.length < 8 || normalizedFrom.length > 15) {
    errors.push("invalid_from");
  }

  if (payload.human_mode === true) {
    errors.push("human_mode_active");
  }

  const hasContent = Boolean(payload.content?.trim());
  const hasMedia = Boolean(payload.media_type);
  if (!hasContent && !hasMedia) {
    errors.push("empty_content");
  }

  if (payload.media_type === "image" && !payload.media_url?.trim()) {
    errors.push("missing_media_url");
  }

  if (
    ["audio", "video", "document"].includes(String(payload.media_type || "")) &&
    !payload.media_url?.trim() &&
    !payload.media_id?.trim()
  ) {
    errors.push("missing_media_reference");
  }

  return {
    ok: errors.length === 0,
    errors,
  };
};
