import type { SupabaseClient } from "@supabase/supabase-js";
import { orderKindLabels } from "@/app/crm/_lib/wispro-caso-schema";
import {
  listAllOpenTeamCasos,
  listCasosForEmployee,
  listPendingCasosForEmployee,
  type TechnicianTicketScope,
} from "./crm-wispro-casos";
import { recordTechnicianEvent, updateTechnicianReportOffset } from "./crm-technicians";
import { matchTechnicianTicketDetail } from "./match-technician-ticket";
import { type MatchedWisproEmployee } from "./match-wispro-employee";
import { phoneLast10 } from "./phone-match";
import { resolveTechnicianByName } from "./resolve-technician-by-name";
import { technicianDeliveryFollowUp } from "./technician-delivery-text";
import {
  getCaracasDateKey,
  looksLikeTechnicianNextPage,
  looksLikeTechnicianResend,
  parseTemporalDateFilter,
  parseTechnicianTicketDetailQuery,
  parseTechnicianTicketScope,
  technicianFirstName,
  type TemporalDateFilter,
} from "./technician-identity";
import {
  formatTechnicianNameMatchMessage,
  technicianResolvedListHeading,
} from "./technician-name-match";
import {
  formatScheduleDateKey,
  formatSupervisorTeamTicketsReport,
  formatTechnicianCaption,
  formatTechnicianList,
  type TechnicianReportCaso,
} from "./technician-report";
import {
  sendWhatsAppImageFromUrl,
  sendWhatsAppText,
} from "./whatsapp-outbound";
import type { CrmWisproCaso } from "./wispro-types";

const PAGE_SIZE = 8;

export const TECHNICIAN_TOOL_NAMES = [
  "list_my_pending_tickets",
  "get_my_ticket_detail",
  "finalize_my_ticket",
] as const;

export const SUPERVISOR_TOOL_NAMES = [
  "get_technician_assigned_tickets",
] as const;

export type TechnicianTicketDelivery = {
  ok: boolean;
  identified: boolean;
  message: string;
  count: number;
  delivered: number;
  remaining: number;
  offset: number;
};

const emptyDelivery = (
  input: Partial<TechnicianTicketDelivery> & { message: string },
): TechnicianTicketDelivery => ({
  ok: false,
  identified: true,
  count: 0,
  delivered: 0,
  remaining: 0,
  offset: 0,
  ...input,
});

const toTechnicianReport = (caso: CrmWisproCaso): TechnicianReportCaso => ({
  wisproPublicId: caso.wisproPublicId,
  kindLabel:
    caso.kind && caso.kind in orderKindLabels
      ? orderKindLabels[caso.kind as keyof typeof orderKindLabels]
      : "Visita técnica",
  clientName: caso.clientName,
  clientPhone: caso.clientPhone,
  cause: caso.cause,
  title: caso.title,
  addressText: caso.addressText,
  mapsUrl: caso.mapsUrl,
  latitude: caso.latitude,
  longitude: caso.longitude,
  windowStart: caso.windowStart,
  windowEnd: caso.windowEnd,
  facadeMediaUrl: caso.facadeMediaUrl,
  status: caso.status,
  closedAt: caso.closedAt,
  priority: caso.priority,
  employeeName: caso.employeeName,
  resolutionObservation: caso.resolutionObservation,
  resolutionSolution: caso.resolutionSolution,
  clientStatus: caso.clientStatus,
  resolutionNotes: caso.resolutionNotes,
});

const loadCasos = async (
  supabase: SupabaseClient,
  employeeId: string,
  options?: {
    scope?: TechnicianTicketScope;
    limit?: number;
    phoneLast10?: string | null;
  },
): Promise<
  { casos: CrmWisproCaso[]; message?: undefined } | { casos: null; message: string }
> => {
  try {
    return { casos: await listCasosForEmployee(supabase, employeeId, options) };
  } catch (error) {
    return {
      casos: null,
      message:
        error instanceof Error
          ? error.message
          : "No se pudieron leer los tickets del técnico",
    };
  }
};

const loadPendingCasos = async (
  supabase: SupabaseClient,
  employeeId: string,
): Promise<
  { casos: CrmWisproCaso[]; message?: undefined } | { casos: null; message: string }
> => loadCasos(supabase, employeeId, { scope: "pending" });

const sendTechnicianTicketCard = async (input: {
  supabase: SupabaseClient;
  conversationId: number;
  to: string;
  report: TechnicianReportCaso;
}) => {
  const caption = formatTechnicianCaption(input.report);
  const metadata = {
    engine: "ai",
    action: "technician_report",
    ticket: input.report.wisproPublicId,
  };

  if (input.report.facadeMediaUrl) {
    try {
      await sendWhatsAppImageFromUrl({
        to: input.to,
        imageUrl: input.report.facadeMediaUrl,
        caption,
        supabase: input.supabase,
        conversationId: input.conversationId,
        metadata,
      });
      return;
    } catch {
      await sendWhatsAppText({
        to: input.to,
        body: caption,
        supabase: input.supabase,
        conversationId: input.conversationId,
        metadata: { ...metadata, action: "technician_report_fallback" },
      });
      return;
    }
  }

  await sendWhatsAppText({
    to: input.to,
    body: caption,
    supabase: input.supabase,
    conversationId: input.conversationId,
    metadata,
  });
};

export const deliverTechnicianPendingTickets = async (input: {
  supabase: SupabaseClient;
  conversationId: number;
  to: string;
  employee: MatchedWisproEmployee;
  technicianId?: string | null;
  inboundText?: string | null;
  storedOffset?: number;
  justVerified?: boolean;
  scope?: TechnicianTicketScope;
}): Promise<TechnicianTicketDelivery> => {
  const scope = input.scope || parseTechnicianTicketScope(input.inboundText);
  const phone10 = phoneLast10(input.employee.phone);
  const loaded = await loadCasos(input.supabase, input.employee.id, {
    scope,
    phoneLast10: phone10,
  });
  if (!loaded.casos) {
    return emptyDelivery({ message: loaded.message || "No se pudieron leer los tickets" });
  }

  const all = loaded.casos;
  const storedOffset = Math.max(0, input.storedOffset || 0);
  const offset = looksLikeTechnicianNextPage(input.inboundText)
    ? storedOffset >= all.length
      ? 0
      : storedOffset
    : 0;
  const page = all.slice(offset, offset + PAGE_SIZE);
  const firstName = technicianFirstName(input.employee.name);

  if (!page.length) {
    await updateTechnicianReportOffset(input.supabase, input.conversationId, 0);
    const emptyMsg =
      offset > 0
        ? "No hay más tickets en este lote."
        : input.employee.isSupervisor
          ? `Hola ${firstName}, no tienes tickets pendientes asignados a tu nombre. Escribe «tickets» para ver el listado del equipo o «tickets de [Nombre]» para consultar a un técnico.`
          : scope === "done"
            ? `Hola ${firstName}, no tienes tickets resueltos en los últimos 7 días. Puedes consultar tus tickets pendientes.`
            : `Hola ${firstName}, no tienes tickets pendientes asignados.`;
    return emptyDelivery({
      ok: true,
      message: emptyMsg,
    });
  }

  const remaining = Math.max(0, all.length - offset - page.length);
  const reports = page.map(toTechnicianReport);

  try {
    await sendWhatsAppText({
      to: input.to,
      body: formatTechnicianList(reports, { startIndex: offset, remaining, scope }),
      supabase: input.supabase,
      conversationId: input.conversationId,
      metadata: { engine: "ai", action: "technician_report_index" },
    });
  } catch (error) {
    return emptyDelivery({
      message:
        error instanceof Error
          ? error.message
          : "No se pudo enviar el listado al técnico",
      count: all.length,
      remaining,
      offset,
    });
  }

  await updateTechnicianReportOffset(
    input.supabase,
    input.conversationId,
    offset + page.length,
  );

  await recordTechnicianEvent(input.supabase, {
    technicianId: input.technicianId ?? null,
    conversationId: input.conversationId,
    event: "tickets_delivered",
    method: looksLikeTechnicianResend(input.inboundText) ? "resend" : "pending",
    metadata: {
      delivered: reports.length,
      remaining,
      count: all.length,
      mode: "list",
      scope,
    },
  });

  return {
    ok: true,
    identified: true,
    message: technicianDeliveryFollowUp({
      delivered: reports.length,
      remaining,
    }),
    count: all.length,
    delivered: reports.length,
    remaining,
    offset: offset + page.length,
  };
};

export const deliverTechnicianTicketDetail = async (input: {
  supabase: SupabaseClient;
  conversationId: number;
  to: string;
  employee: MatchedWisproEmployee;
  technicianId?: string | null;
  inboundText?: string | null;
  publicId?: number | null;
  clientName?: string | null;
  listIndex?: number | null;
}): Promise<TechnicianTicketDelivery> => {
  const loaded = await loadPendingCasos(input.supabase, input.employee.id);
  if (!loaded.casos) {
    return emptyDelivery({ message: loaded.message || "No se pudieron leer los tickets pendientes" });
  }

  const all = loaded.casos;
  const parsed = parseTechnicianTicketDetailQuery(input.inboundText);
  const query = {
    publicId: input.publicId ?? parsed.publicId,
    clientName: input.clientName ?? parsed.clientName,
    listIndex: input.listIndex ?? parsed.listIndex,
  };
  const hasFilter =
    query.publicId != null ||
    Boolean(query.clientName?.trim()) ||
    query.listIndex != null;
  const matches = matchTechnicianTicketDetail(all, query);

  if (!all.length) {
    return emptyDelivery({
      ok: true,
      message: "No tienes tickets pendientes asignados.",
    });
  }

  if (!matches.length) {
    return {
      ok: true,
      identified: true,
      message: hasFilter
        ? "No encontré ese caso en tu cola. Escribe el número o el nombre de la lista."
        : "¿De cuál caso necesitas la ficha? Escribe el número o el nombre de la lista.",
      count: all.length,
      delivered: 0,
      remaining: all.length,
      offset: 0,
    };
  }

  if (matches.length > 1) {
    return {
      ok: true,
      identified: true,
      message: formatTechnicianList(matches.map(toTechnicianReport), {
        heading: "Hay varios casos con ese dato:",
      }),
      count: all.length,
      delivered: 0,
      remaining: all.length,
      offset: 0,
    };
  }

  const target = matches[0];
  try {
    await sendTechnicianTicketCard({
      supabase: input.supabase,
      conversationId: input.conversationId,
      to: input.to,
      report: toTechnicianReport(target),
    });
  } catch (error) {
    return emptyDelivery({
      message:
        error instanceof Error
          ? error.message
          : "No se pudo enviar la ficha del ticket",
      count: all.length,
      remaining: all.length,
    });
  }

  await recordTechnicianEvent(input.supabase, {
    technicianId: input.technicianId ?? null,
    conversationId: input.conversationId,
    event: "ticket_detail_delivered",
    method: "detail",
    metadata: {
      public_id: target.wisproPublicId,
      client_name: target.clientName,
    },
  });

  return {
    ok: true,
    identified: true,
    message: "",
    count: all.length,
    delivered: 1,
    remaining: Math.max(0, all.length - 1),
    offset: 0,
  };
};

export type MonitoredTechnicianQueue = TechnicianTicketDelivery & {
  technicianName: string | null;
  technicianId: string | null;
  candidates: Array<{ id: string; name: string }>;
  suggestions: Array<{ id: string; name: string; score: number }>;
  matchStatus: "resolved" | "ambiguous" | "not_found" | null;
  matchedBy: string | null;
  score: number | null;
  tickets: Array<{
    public_id: number | null;
    client_name: string | null;
    cause: string | null;
    address: string | null;
    status: string;
  }>;
};

const emptyMonitoredQueue = (
  input: Partial<MonitoredTechnicianQueue> & { message: string },
): MonitoredTechnicianQueue => ({
  ok: false,
  identified: true,
  count: 0,
  delivered: 0,
  remaining: 0,
  offset: 0,
  technicianName: null,
  technicianId: null,
  candidates: [],
  suggestions: [],
  matchStatus: null,
  matchedBy: null,
  score: null,
  tickets: [],
  ...input,
});

export const deliverMonitoredTechnicianTickets = async (input: {
  supabase: SupabaseClient;
  conversationId: number;
  to: string;
  supervisor: MatchedWisproEmployee;
  technicianId?: string | null;
  technicianName: string;
  deliver?: boolean;
  scope?: TechnicianTicketScope;
  temporal?: TemporalDateFilter;
  inboundText?: string | null;
}): Promise<MonitoredTechnicianQueue> => {
  const deliver = input.deliver !== false;
  const scope: TechnicianTicketScope =
    input.scope || parseTechnicianTicketScope(input.inboundText) || "pending";
  const temporal: TemporalDateFilter =
    input.temporal || parseTemporalDateFilter(input.inboundText);

  let resolved;
  try {
    resolved = await resolveTechnicianByName(input.supabase, input.technicianName);
  } catch (error) {
    return emptyMonitoredQueue({
      message:
        error instanceof Error
          ? error.message
          : "No se pudo buscar al técnico",
    });
  }

  if (resolved.status !== "resolved") {
    const names =
      resolved.status === "ambiguous"
        ? resolved.candidates.map((item) => item.employee.name)
        : [];
    return emptyMonitoredQueue({
      ok: true,
      matchStatus: resolved.status,
      candidates:
        resolved.status === "ambiguous"
          ? resolved.candidates.map((item) => ({
              id: item.employee.id,
              name: item.employee.name,
            }))
          : [],
      suggestions:
        resolved.status === "not_found"
          ? resolved.suggestions.map((item) => ({
              id: item.employee.id,
              name: item.employee.name,
              score: item.score,
            }))
          : [],
      message:
        formatTechnicianNameMatchMessage(input.technicianName, resolved) ||
        (names.length
          ? `Hay varios: ${names.join(", ")}. ¿Cuál?`
          : `No encontré «${input.technicianName.trim()}».`),
    });
  }

  const target = resolved.employee;
  const loaded = await loadCasos(input.supabase, target.id, {
    scope,
    limit: scope === "done" ? 50 : 25,
  });
  if (!loaded.casos) {
    return emptyMonitoredQueue({
      message: loaded.message || "No se pudieron leer los tickets del técnico",
      technicianName: target.name,
      technicianId: target.id,
    });
  }

  let dateTitle: string | undefined;
  let filteredCasos = loaded.casos;

  if (temporal === "today") {
    const todayKey = getCaracasDateKey(0);
    dateTitle = `de Hoy (${todayKey})`;
    filteredCasos = loaded.casos.filter((c) => {
      const dateToCheck = scope === "done" ? (c.closedAt || c.windowStart) : c.windowStart;
      return formatScheduleDateKey(dateToCheck) === todayKey;
    });
  } else if (temporal === "tomorrow") {
    const tomorrowKey = getCaracasDateKey(1);
    dateTitle = `de Mañana (${tomorrowKey})`;
    filteredCasos = loaded.casos.filter((c) => {
      const dateToCheck = scope === "done" ? (c.closedAt || c.windowStart) : c.windowStart;
      return formatScheduleDateKey(dateToCheck) === tomorrowKey;
    });
  }

  const tickets = filteredCasos.map((caso) => ({
    public_id: caso.wisproPublicId,
    client_name: caso.clientName,
    cause: caso.cause || caso.title,
    address: caso.addressText,
    status: caso.status,
  }));
  const firstName = target.name.trim() || "el técnico";

  if (!filteredCasos.length) {
    let emptyMsg: string;
    if (scope === "done") {
      if (temporal === "today") {
        const todayKey = getCaracasDateKey(0);
        emptyMsg = `${firstName} no tiene tickets resueltos el día de hoy (${todayKey}). Puedes consultar sus tickets pendientes.`;
      } else if (temporal === "tomorrow") {
        const tomorrowKey = getCaracasDateKey(1);
        emptyMsg = `${firstName} no tiene tickets resueltos para mañana (${tomorrowKey}).`;
      } else {
        emptyMsg = `${firstName} no tiene tickets resueltos en los últimos 7 días. Puedes consultar sus tickets pendientes.`;
      }
    } else if (scope === "all") {
      emptyMsg = `${firstName} no tiene tickets registrados.`;
    } else {
      if (temporal === "today") {
        const todayKey = getCaracasDateKey(0);
        emptyMsg = loaded.casos.length > 0
          ? `${firstName} no tiene tickets agendados para hoy (${todayKey}). Tiene ${loaded.casos.length} tickets pendientes en otras fechas o por definir.`
          : `${firstName} no tiene tickets agendados para hoy (${todayKey}).`;
      } else if (temporal === "tomorrow") {
        const tomorrowKey = getCaracasDateKey(1);
        emptyMsg = `${firstName} no tiene tickets agendados para mañana (${tomorrowKey}).`;
      } else {
        emptyMsg = `${firstName} no tiene tickets pendientes asignados.`;
      }
    }
    return {
      ok: true,
      identified: true,
      message: emptyMsg,
      count: 0,
      delivered: 0,
      remaining: 0,
      offset: 0,
      technicianName: target.name,
      technicianId: target.id,
      candidates: [],
      suggestions: [],
      matchStatus: "resolved",
      matchedBy: resolved.matchedBy,
      score: resolved.score,
      tickets,
    };
  }

  const reports = filteredCasos.map((c) => ({
    ...toTechnicianReport(c),
    employeeName: c.employeeName || target.name,
  }));
  const body = formatSupervisorTeamTicketsReport(reports, {
    dateTitle,
    totalUnfilteredCount: loaded.casos.length,
    temporalFilter: temporal,
    scope,
    technicianName: target.name,
  });

  if (deliver) {
    try {
      await sendWhatsAppText({
        to: input.to,
        body,
        supabase: input.supabase,
        conversationId: input.conversationId,
        metadata: {
          engine: "ai",
          action: "supervisor_technician_queue",
          technician: target.id,
          scope,
          temporal,
        },
      });
    } catch (error) {
      return emptyMonitoredQueue({
        message:
          error instanceof Error
            ? error.message
            : "No se pudo enviar el listado al supervisor",
        technicianName: target.name,
        technicianId: target.id,
        tickets,
        count: filteredCasos.length,
      });
    }
  }

  await recordTechnicianEvent(input.supabase, {
    technicianId: input.technicianId ?? null,
    conversationId: input.conversationId,
    event: "supervisor_inspected_technician",
    method: deliver ? "list" : "summary",
    metadata: {
      target_employee_id: target.id,
      target_name: target.name,
      count: filteredCasos.length,
      supervisor_employee_id: input.supervisor.id,
      scope,
      temporal,
    },
  });

  return {
    ok: true,
    identified: true,
    message: deliver ? "" : body,
    count: filteredCasos.length,
    delivered: deliver ? filteredCasos.length : 0,
    remaining: 0,
    offset: 0,
    technicianName: target.name,
    technicianId: target.id,
    candidates: [],
    suggestions: [],
    matchStatus: "resolved",
    matchedBy: resolved.matchedBy,
    score: resolved.score,
    tickets,
  };
};

export const deliverSupervisorTeamTickets = async (input: {
  supabase: SupabaseClient;
  conversationId: number;
  to: string;
  supervisor: MatchedWisproEmployee;
  inboundText?: string | null;
  scope?: TechnicianTicketScope;
  temporal?: TemporalDateFilter;
}): Promise<TechnicianTicketDelivery> => {
  const scope: TechnicianTicketScope =
    input.scope || parseTechnicianTicketScope(input.inboundText) || "pending";
  const temporal: TemporalDateFilter =
    input.temporal || parseTemporalDateFilter(input.inboundText);

  let allCasos: CrmWisproCaso[];
  try {
    allCasos = await listAllOpenTeamCasos(input.supabase, {
      scope,
      limit: scope === "done" ? 150 : 100,
    });
  } catch (error) {
    return emptyDelivery({
      message:
        error instanceof Error
          ? error.message
          : "No se pudieron consultar los tickets del equipo",
    });
  }

  let dateTitle: string | undefined;
  let filteredCasos = allCasos;

  if (temporal === "today") {
    const todayKey = getCaracasDateKey(0);
    dateTitle = `de Hoy (${todayKey})`;
    filteredCasos = allCasos.filter((c) => {
      const dateToCheck = scope === "done" ? (c.closedAt || c.windowStart) : c.windowStart;
      return formatScheduleDateKey(dateToCheck) === todayKey;
    });
  } else if (temporal === "tomorrow") {
    const tomorrowKey = getCaracasDateKey(1);
    dateTitle = `de Mañana (${tomorrowKey})`;
    filteredCasos = allCasos.filter((c) => {
      const dateToCheck = scope === "done" ? (c.closedAt || c.windowStart) : c.windowStart;
      return formatScheduleDateKey(dateToCheck) === tomorrowKey;
    });
  }

  const reports = filteredCasos.map(toTechnicianReport);
  const messageBody = formatSupervisorTeamTicketsReport(reports, {
    dateTitle,
    totalUnfilteredCount: allCasos.length,
    temporalFilter: temporal,
    scope,
  });

  try {
    await sendWhatsAppText({
      to: input.to,
      body: messageBody,
      supabase: input.supabase,
      conversationId: input.conversationId,
      metadata: {
        engine: "ai",
        action: "supervisor_team_tickets",
        scope,
        temporal,
      },
    });
  } catch (error) {
    return emptyDelivery({
      message:
        error instanceof Error
          ? error.message
          : "No se pudo enviar el reporte de tickets al supervisor",
      count: filteredCasos.length,
    });
  }

  await recordTechnicianEvent(input.supabase, {
    technicianId: null,
    conversationId: input.conversationId,
    event: "supervisor_team_tickets_delivered",
    method: "team_list",
    metadata: {
      delivered: filteredCasos.length,
      totalUnfiltered: allCasos.length,
      temporal,
      scope,
    },
  });

  return {
    ok: true,
    identified: true,
    message: "",
    count: filteredCasos.length,
    delivered: filteredCasos.length,
    remaining: 0,
    offset: 0,
  };
};
