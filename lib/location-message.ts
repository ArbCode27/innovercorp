import { buildMapsUrl } from "./maps-link";

export type LocationMessageFields = {
  content?: string | null;
  latitude?: number | null;
  longitude?: number | null;
  location_name?: string | null;
  location_address?: string | null;
};

const toCoord = (value: number | null | undefined) =>
  typeof value === "number" && Number.isFinite(value) ? value : null;

export const formatLocationForAi = (message: LocationMessageFields) => {
  const latitude = toCoord(message.latitude);
  const longitude = toCoord(message.longitude);
  const name = String(message.location_name || "").trim();
  const address = String(message.location_address || "").trim();
  const content = String(message.content || "").trim();
  const bits = ["[Ubicación]"];

  if (name) bits.push(name);
  if (address && address !== name) bits.push(address);
  if (latitude != null && longitude != null) {
    bits.push(`${latitude}, ${longitude}`);
    bits.push(buildMapsUrl({ latitude, longitude }));
  } else if (content && content.toLowerCase() !== "ubicación compartida") {
    bits.push(content);
  }

  return bits.join(" · ");
};
