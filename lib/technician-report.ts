import { resolveMapsUrl } from "./maps-link";

export const TECHNICIAN_CAPTION_MAX = 1024;

export type TechnicianReportCaso = {
  wisproPublicId: number | null;
  kindLabel?: string | null;
  clientName: string | null;
  clientPhone: string | null;
  cause: string | null;
  title: string | null;
  addressText: string | null;
  mapsUrl: string | null;
  latitude: number | null;
  longitude: number | null;
  windowStart: string | null;
  windowEnd: string | null;
  facadeMediaUrl: string | null;
};

const formatWindow = (start: string | null, end: string | null) => {
  if (!start && !end) return null;
  try {
    const formatter = new Intl.DateTimeFormat("es-VE", {
      timeZone: "America/Caracas",
      day: "2-digit",
      month: "2-digit",
      hour: "2-digit",
      minute: "2-digit",
      hour12: false,
    });
    if (start && end) {
      return `${formatter.format(new Date(start))} – ${formatter.format(new Date(end))}`;
    }
    return formatter.format(new Date(start || end || ""));
  } catch {
    return [start, end].filter(Boolean).join(" – ") || null;
  }
};

export const formatTechnicianCaption = (caso: TechnicianReportCaso) => {
  const ticket =
    caso.wisproPublicId != null ? `#${caso.wisproPublicId}` : "Ticket";
  const kind = caso.kindLabel?.trim() || "Visita técnica";
  const maps =
    resolveMapsUrl({
      mapsUrl: caso.mapsUrl,
      latitude: caso.latitude,
      longitude: caso.longitude,
    }) || "no disponible";

  const lines = [
    `Ticket ${ticket} · ${kind}`,
    `Nombre: ${caso.clientName?.trim() || "N/D"}`,
    `Tel: ${caso.clientPhone?.trim() || "N/D"}`,
    `Causa: ${(caso.cause || caso.title || "N/D").trim()}`,
    caso.addressText?.trim() ? `Dirección: ${caso.addressText.trim()}` : null,
    `Maps: ${maps}`,
  ];

  const window = formatWindow(caso.windowStart, caso.windowEnd);
  if (window) lines.push(`Ventana: ${window}`);

  const caption = lines.filter(Boolean).join("\n");
  return caption.length <= TECHNICIAN_CAPTION_MAX
    ? caption
    : caption.slice(0, TECHNICIAN_CAPTION_MAX - 1);
};

export type FormatTechnicianListOptions = {
  startIndex?: number;
  remaining?: number;
  heading?: string;
};

const ticketTitle = (caso: TechnicianReportCaso) =>
  (caso.cause || caso.title || "Sin título").trim() || "Sin título";

const ticketLocation = (caso: TechnicianReportCaso) =>
  caso.addressText?.trim() || "Sin ubicación";

export const formatTechnicianList = (
  casos: TechnicianReportCaso[],
  options?: FormatTechnicianListOptions,
) => {
  if (!casos.length) return "No tienes tickets pendientes asignados.";
  const startIndex = Math.max(0, options?.startIndex ?? 0);
  const remaining = Math.max(0, options?.remaining ?? 0);
  const total = startIndex + casos.length + remaining;
  const header =
    options?.heading ||
    (total === 1
      ? "Tienes 1 ticket pendiente:"
      : `Tienes ${total} tickets pendientes:`);
  const blocks = casos.map((caso, index) => {
    const name = caso.clientName?.trim() || "Cliente";
    return [
      `${startIndex + index + 1}. ${name}`,
      `   ${ticketTitle(caso)}`,
      `   Ubicación: ${ticketLocation(caso)}`,
    ].join("\n");
  });
  const hint =
    remaining > 0
      ? "Escribe *siguiente* para ver más, o el número o el nombre para la ficha completa."
      : "Escribe el número o el nombre para ver la ficha completa.";
  return [header, "", blocks.join("\n\n"), "", hint].join("\n");
};
