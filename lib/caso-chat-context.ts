import { buildMapsUrl, extractMapsFromText } from "./maps-link";

export type CasoChatMessage = {
  id?: number;
  type?: string | null;
  sender_type?: string | null;
  content?: string | null;
  caption?: string | null;
  media_url?: string | null;
  media_type?: string | null;
  latitude?: number | null;
  longitude?: number | null;
  location_name?: string | null;
  location_address?: string | null;
  created_at?: string | null;
};

export type CasoChatImage = {
  messageId: number | null;
  mediaUrl: string;
  caption: string | null;
  createdAt: string | null;
};

export type CasoChatContext = {
  mapsUrl: string | null;
  latitude: number | null;
  longitude: number | null;
  addressText: string | null;
  facade: CasoChatImage | null;
  images: CasoChatImage[];
};

const isInbound = (message: CasoChatMessage) =>
  message.type === "in" || message.sender_type === "client";

const isFiniteCoord = (latitude: number, longitude: number) =>
  Number.isFinite(latitude) &&
  Number.isFinite(longitude) &&
  Math.abs(latitude) <= 90 &&
  Math.abs(longitude) <= 180;

const FACADE_WINDOW_MS = 48 * 60 * 60 * 1000;

export const collectCasoContextFromMessages = (
  messages: CasoChatMessage[],
  extraText = "",
): CasoChatContext => {
  const images: CasoChatImage[] = [];
  const extraMaps = extractMapsFromText(extraText);
  let mapsUrl: string | null = extraMaps.mapsUrl;
  let latitude: number | null = extraMaps.latitude;
  let longitude: number | null = extraMaps.longitude;
  let addressText: string | null = null;
  const now = Date.now();

  for (const message of messages) {
    const blob = [message.content, message.caption].filter(Boolean).join(" ");
    const found = extractMapsFromText(blob);
    if (found.mapsUrl && !mapsUrl) {
      mapsUrl = found.mapsUrl;
      latitude = found.latitude ?? latitude;
      longitude = found.longitude ?? longitude;
    }

    if (
      latitude == null &&
      longitude == null &&
      isInbound(message) &&
      message.latitude != null &&
      message.longitude != null &&
      isFiniteCoord(message.latitude, message.longitude)
    ) {
      latitude = message.latitude;
      longitude = message.longitude;
      mapsUrl = mapsUrl || buildMapsUrl({
        latitude: message.latitude,
        longitude: message.longitude,
      });
      addressText =
        [message.location_name, message.location_address]
          .map((value) => String(value || "").trim())
          .filter(Boolean)
          .join(" · ") || addressText;
    }

    if (
      isInbound(message) &&
      String(message.media_type || "").toLowerCase() === "image" &&
      message.media_url
    ) {
      const createdAt = message.created_at
        ? Date.parse(message.created_at)
        : NaN;
      if (
        !Number.isFinite(createdAt) ||
        now - createdAt <= FACADE_WINDOW_MS
      ) {
        images.push({
          messageId: typeof message.id === "number" ? message.id : null,
          mediaUrl: message.media_url,
          caption: message.caption || message.content || null,
          createdAt: message.created_at || null,
        });
      }
    }
  }

  return {
    mapsUrl,
    latitude,
    longitude,
    addressText,
    facade: images.length ? images[images.length - 1] || null : null,
    images,
  };
};
