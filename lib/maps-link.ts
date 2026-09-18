const MAPS_URL_RE =
  /https?:\/\/(?:maps\.app\.goo\.gl|goo\.gl\/maps|maps\.google\.[^\s]+|www\.google\.[^\s/]+\/maps|google\.[^\s/]+\/maps)[^\s)<>"']*/gi;

const COORD_Q_RE = /[?&]q=(-?\d+(?:\.\d+)?)\s*,\s*(-?\d+(?:\.\d+)?)/i;
const COORD_AT_RE = /@(-?\d+(?:\.\d+)?),(-?\d+(?:\.\d+)?)/;
const COORD_DIR_RE =
  /\/dir\/(-?\d+(?:\.\d+)?)\s*,\s*(-?\d+(?:\.\d+)?)/i;
const BARE_COORD_RE =
  /(-?\d{1,2}\.\d{3,})\s*,\s*(-?\d{1,3}\.\d{3,})/;

export type MapsCoords = {
  latitude: number;
  longitude: number;
};

const isFiniteCoord = (latitude: number, longitude: number) =>
  Number.isFinite(latitude) &&
  Number.isFinite(longitude) &&
  Math.abs(latitude) <= 90 &&
  Math.abs(longitude) <= 180;

export const buildMapsUrl = (coords: MapsCoords) =>
  `https://maps.google.com/?q=${coords.latitude},${coords.longitude}`;

export const parseCoordsFromMapsUrl = (
  value: string | null | undefined,
): MapsCoords | null => {
  const raw = String(value || "").trim();
  if (!raw) return null;

  const match =
    raw.match(COORD_Q_RE) ||
    raw.match(COORD_AT_RE) ||
    raw.match(COORD_DIR_RE) ||
    raw.match(BARE_COORD_RE);
  if (!match) return null;

  const latitude = Number(match[1]);
  const longitude = Number(match[2]);
  if (!isFiniteCoord(latitude, longitude)) return null;
  return { latitude, longitude };
};

export const extractMapsUrl = (value: string | null | undefined) => {
  const text = String(value || "");
  if (!text.trim()) return null;
  const matches = text.match(MAPS_URL_RE);
  const first = matches?.[0]?.replace(/[.,;]+$/, "") || null;
  return first;
};

export const normalizeMapsUrl = (value: string | null | undefined) => {
  const trimmed = String(value || "").trim();
  if (!trimmed) return null;
  if (/^https?:\/\//i.test(trimmed)) return trimmed;
  if (/^(maps\.app\.goo\.gl|goo\.gl\/maps|maps\.google\.|www\.google\.[^/]+\/maps)/i.test(trimmed)) {
    return `https://${trimmed}`;
  }
  return trimmed;
};

export const resolveMapsUrl = (input: {
  mapsUrl?: string | null;
  latitude?: number | null;
  longitude?: number | null;
}) => {
  const explicit = normalizeMapsUrl(input.mapsUrl);
  if (explicit) return explicit;
  if (
    input.latitude != null &&
    input.longitude != null &&
    isFiniteCoord(input.latitude, input.longitude)
  ) {
    return buildMapsUrl({
      latitude: input.latitude,
      longitude: input.longitude,
    });
  }
  return null;
};

export const withMapsInDescription = (
  description: string,
  mapsUrl: string | null | undefined,
) => {
  const url = normalizeMapsUrl(mapsUrl);
  if (!url) return description.trim();
  if (description.toLowerCase().includes(url.toLowerCase())) {
    return description.trim();
  }
  return `${description.trim()}\n\nMaps: ${url}`;
};
