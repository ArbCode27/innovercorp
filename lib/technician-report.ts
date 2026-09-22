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
  status?: string | null;
  closedAt?: string | null;
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
  hint?: string | null;
  scope?: "pending" | "done" | "all";
};

export const formatScheduleDateKey = (
  dateStr: string | null | undefined,
): string | null => {
  if (!dateStr) return null;
  try {
    const d = new Date(dateStr);
    if (isNaN(d.getTime())) return null;
    return new Intl.DateTimeFormat("es-VE", {
      timeZone: "America/Caracas",
      day: "2-digit",
      month: "2-digit",
      year: "numeric",
    }).format(d);
  } catch {
    return null;
  }
};

export const formatResolvedDate = (
  dateStr: string | null | undefined,
): string | null => {
  if (!dateStr) return null;
  try {
    const d = new Date(dateStr);
    if (isNaN(d.getTime())) return null;
    return new Intl.DateTimeFormat("es-VE", {
      timeZone: "America/Caracas",
      day: "2-digit",
      month: "2-digit",
      year: "numeric",
      hour: "2-digit",
      minute: "2-digit",
      hour12: false,
    }).format(d);
  } catch {
    return null;
  }
};

const ticketTitle = (caso: TechnicianReportCaso) =>
  (caso.cause || caso.title || "Sin título").trim() || "Sin título";

const ticketLocation = (caso: TechnicianReportCaso) =>
  caso.addressText?.trim() || "Sin ubicación";

const formatSingleCasoBlock = (
  caso: TechnicianReportCaso,
  indexNumber: number,
) => {
  const name = caso.clientName?.trim() || "Cliente";
  const lines = [
    `${indexNumber}. ${name}`,
    `   ${ticketTitle(caso)}`,
    `   Ubicación: ${ticketLocation(caso)}`,
  ];
  if (caso.status === "done" && caso.closedAt) {
    const resDate = formatResolvedDate(caso.closedAt);
    if (resDate) lines.push(`   Resuelto: ${resDate}`);
  }
  return lines.join("\n");
};

export const formatTechnicianList = (
  casos: TechnicianReportCaso[],
  options?: FormatTechnicianListOptions,
) => {
  if (!casos.length) {
    if (options?.scope === "done") {
      return "No tienes tickets resueltos en los últimos 7 días.";
    }
    return "No tienes tickets pendientes asignados.";
  }

  const startIndex = Math.max(0, options?.startIndex ?? 0);
  const remaining = Math.max(0, options?.remaining ?? 0);
  const total = startIndex + casos.length + remaining;
  const isDoneScope = options?.scope === "done";
  const header =
    options?.heading ||
    (isDoneScope
      ? total === 1
        ? "Tienes 1 ticket resuelto:"
        : `Tienes ${total} tickets resueltos:`
      : total === 1
        ? "Tienes 1 ticket pendiente:"
        : `Tienes ${total} tickets pendientes:`);

  // Check if any ticket has a schedule date (or closed date for done)
  const hasAnyDate = casos.some(
    (c) => Boolean(c.windowStart) || (isDoneScope && Boolean(c.closedAt)),
  );

  let formattedContent = "";

  if (!hasAnyDate) {
    // If no dates provided, format as flat list
    formattedContent = casos
      .map((caso, index) =>
        formatSingleCasoBlock(caso, startIndex + index + 1),
      )
      .join("\n\n");
  } else {
    // Group by date
    type DateGroup = {
      dateLabel: string;
      items: Array<{ caso: TechnicianReportCaso; itemIndex: number }>;
    };
    const groupsMap = new Map<string, DateGroup>();

    casos.forEach((caso, index) => {
      const itemIndex = startIndex + index + 1;
      const dateKey = isDoneScope
        ? formatScheduleDateKey(caso.closedAt) || "Sin fecha de cierre"
        : formatScheduleDateKey(caso.windowStart) || "Sin agendar / Fecha por definir";

      if (!groupsMap.has(dateKey)) {
        groupsMap.set(dateKey, { dateLabel: dateKey, items: [] });
      }
      groupsMap.get(dateKey)!.items.push({ caso, itemIndex });
    });

    const groupSections: string[] = [];
    for (const group of groupsMap.values()) {
      const itemBlocks = group.items.map((item) =>
        formatSingleCasoBlock(item.caso, item.itemIndex),
      );
      groupSections.push(
        `${group.dateLabel}:\n${itemBlocks.join("\n\n")}`,
      );
    }
    formattedContent = groupSections.join("\n\n");
  }

  const hint =
    options?.hint === undefined
      ? remaining > 0
        ? "Escribe *siguiente* para ver más, o el número o el nombre para la ficha completa."
        : "Escribe el número o el nombre para ver la ficha completa."
      : options.hint;

  return [header, "", formattedContent, hint ? `\n${hint}` : ""]
    .join("\n")
    .trimEnd();
};
