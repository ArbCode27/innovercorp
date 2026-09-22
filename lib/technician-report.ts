import { resolveMapsUrl } from "./maps-link";
import { getCaracasDateKey } from "./technician-identity";

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
  priority?: string | null;
  employeeName?: string | null;
};

export const formatWindow = (start: string | null, end: string | null) => {
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

export type SupervisorTeamReportOptions = {
  dateTitle?: string;
  totalUnfilteredCount?: number;
  temporalFilter?: "today" | "tomorrow" | "all";
  maxItems?: number;
  scope?: "pending" | "done" | "all";
  technicianName?: string;
  heading?: string;
};

const priorityBadge = (priority?: string | null) => {
  if (priority === "urgent") return " · 🔥 Urgente";
  if (priority === "high") return " · ⚠️ Alta";
  if (priority === "low") return " · 🟢 Baja";
  return "";
};

export const formatSupervisorTeamTicketsReport = (
  casos: (TechnicianReportCaso & { priority?: string | null; employeeName?: string | null })[],
  options?: SupervisorTeamReportOptions,
): string => {
  if (!casos.length) {
    if (options?.technicianName) {
      const techName = options.technicianName.trim();
      if (options?.scope === "done") {
        if (options?.temporalFilter === "today") {
          const todayKey = getCaracasDateKey(0);
          return `📋 ${techName} no tiene tickets resueltos el día de hoy (${todayKey}).`;
        }
        if (options?.temporalFilter === "tomorrow") {
          const tomorrowKey = getCaracasDateKey(1);
          return `📋 ${techName} no tiene tickets resueltos para mañana (${tomorrowKey}).`;
        }
        return `📋 ${techName} no tiene tickets resueltos en los últimos 7 días.`;
      }
      if (options?.temporalFilter === "today") {
        const todayKey = getCaracasDateKey(0);
        return options.totalUnfilteredCount
          ? `📋 ${techName} no tiene tickets agendados para hoy (${todayKey}). Tiene ${options.totalUnfilteredCount} tickets pendientes en otras fechas o por definir.`
          : `📋 ${techName} no tiene tickets agendados para hoy (${todayKey}).`;
      }
      if (options?.temporalFilter === "tomorrow") {
        const tomorrowKey = getCaracasDateKey(1);
        return `📋 ${techName} no tiene tickets agendados para mañana (${tomorrowKey}).`;
      }
      return `📋 ${techName} no tiene tickets pendientes asignados.`;
    }

    if (options?.scope === "done") {
      if (options?.temporalFilter === "today") {
        const todayKey = getCaracasDateKey(0);
        return `📋 No hay tickets resueltos el día de hoy (${todayKey}).`;
      }
      if (options?.temporalFilter === "tomorrow") {
        const tomorrowKey = getCaracasDateKey(1);
        return `📋 No hay tickets resueltos agendados para mañana (${tomorrowKey}).`;
      }
      return "📋 No hay tickets resueltos registrados en el sistema.";
    }

    if (options?.temporalFilter === "today") {
      const todayKey = getCaracasDateKey(0);
      return options.totalUnfilteredCount
        ? `📋 No hay tickets agendados para hoy (${todayKey}). Hay ${options.totalUnfilteredCount} tickets pendientes en otras fechas o por definir.`
        : `📋 No hay tickets agendados para hoy (${todayKey}).`;
    }
    if (options?.temporalFilter === "tomorrow") {
      const tomorrowKey = getCaracasDateKey(1);
      return `📋 No hay tickets agendados para mañana (${tomorrowKey}).`;
    }
    return "📋 No hay tickets pendientes registrados en el sistema.";
  }

  const isDone = options?.scope === "done";
  const maxItems = options?.maxItems ?? 25;
  const displayCasos = casos.slice(0, maxItems);
  const truncatedCount = casos.length - displayCasos.length;

  // Group by Technician
  const byTechnician = new Map<string, typeof displayCasos>();
  for (const caso of displayCasos) {
    const rawName = caso.employeeName?.trim();
    const techName = rawName || (options?.technicianName?.trim() ?? "Sin asignar");
    if (!byTechnician.has(techName)) {
      byTechnician.set(techName, []);
    }
    byTechnician.get(techName)!.push(caso);
  }

  // Sort technicians alphabetically with "Sin asignar" at the end
  const sortedTechKeys = [...byTechnician.keys()].sort((a, b) => {
    if (a === "Sin asignar") return 1;
    if (b === "Sin asignar") return -1;
    return a.localeCompare(b, "es", { sensitivity: "base" });
  });

  const sections: string[] = [];
  const dateTitle = options?.dateTitle ? ` ${options.dateTitle}` : "";

  if (options?.heading) {
    sections.push(options.heading);
  } else if (options?.technicianName) {
    const title = isDone ? "Tickets Resueltos" : "Listado de Tickets";
    sections.push(`📋 *${title} de ${options.technicianName}${dateTitle}*`);
    sections.push(
      `Total: ${casos.length} ticket${casos.length === 1 ? "" : "s"} ${isDone ? "resuelto" : "activo"}${casos.length === 1 ? "" : "s"}.`,
    );
  } else {
    const title = isDone ? "Tickets Resueltos del Equipo" : "Listado de Tickets del Equipo";
    sections.push(`📋 *${title}${dateTitle}*`);
    sections.push(
      `Total: ${casos.length} ticket${casos.length === 1 ? "" : "s"} ${isDone ? "resuelto" : "activo"}${casos.length === 1 ? "" : "s"} distribuido${casos.length === 1 ? "" : "s"} en ${sortedTechKeys.length} cola${sortedTechKeys.length === 1 ? "" : "s"}.`,
    );
  }

  for (const techKey of sortedTechKeys) {
    const techCasos = byTechnician.get(techKey)!;
    const isUnassigned = techKey === "Sin asignar";
    const headerPrefix = isUnassigned ? "⚠️" : "👷";
    const techHeader = `${headerPrefix} *${techKey.toUpperCase()}* (${techCasos.length}):`;

    // Group by Date for this technician
    const dateGroups = new Map<string, typeof techCasos>();
    for (const caso of techCasos) {
      const dateKey = isDone
        ? formatScheduleDateKey(caso.closedAt) || formatScheduleDateKey(caso.windowStart) || "Fecha por definir"
        : formatScheduleDateKey(caso.windowStart) || "Fecha por definir";
      if (!dateGroups.has(dateKey)) {
        dateGroups.set(dateKey, []);
      }
      dateGroups.get(dateKey)!.push(caso);
    }

    const techDateSections: string[] = [];
    let itemCounter = 1;

    for (const [dateLabel, groupCasos] of dateGroups.entries()) {
      const dateHeader = `📅 ${dateLabel}:`;
      const itemBlocks = groupCasos.map((caso) => {
        const idx = itemCounter++;
        const publicId =
          caso.wisproPublicId != null ? `#${caso.wisproPublicId}` : "s/n";
        const priority = priorityBadge(caso.priority);
        const window = formatWindow(caso.windowStart, caso.windowEnd);
        const windowLine = window ? `\n   Horario: ${window}` : "";
        const location = caso.addressText?.trim();
        const locationLine = location ? `\n   Ubicación: ${location}` : "";
        const title = (caso.cause || caso.title || "Visita técnica").trim();
        const resDate = (isDone || caso.status === "done") && caso.closedAt ? formatResolvedDate(caso.closedAt) : null;
        const resLine = resDate ? `\n   Resuelto: ${resDate}` : "";

        return [
          `${idx}. *${caso.clientName?.trim() || "Cliente"}* (${publicId})${priority}`,
          `   ${title}${resLine || windowLine}${locationLine}`,
        ].join("\n");
      });

      techDateSections.push(`${dateHeader}\n${itemBlocks.join("\n\n")}`);
    }

    sections.push(`${techHeader}\n${techDateSections.join("\n\n")}`);
  }

  if (truncatedCount > 0) {
    sections.push(
      `_Mostrando los primeros ${maxItems} tickets de ${casos.length}. Escribe «tickets de [Nombre]» para ver la cola completa de un técnico._`,
    );
  }

  if (options?.technicianName) {
    sections.push(
      `_Para ver la lista completa del equipo escribe «tickets». Para ver tus propias asignaciones escribe «mis tickets»._`,
    );
  } else {
    sections.push(
      `_Para ver la cola de un solo técnico escribe «tickets de [Nombre]». Para ver tus propias asignaciones escribe «mis tickets»._`,
    );
  }

  return sections.join("\n\n");
};
