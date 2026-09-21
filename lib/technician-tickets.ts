import type { SupabaseClient } from "@supabase/supabase-js";
import { orderKindLabels } from "@/app/crm/_lib/wispro-caso-schema";
import { listPendingCasosForEmployee } from "./crm-wispro-casos";
import { recordTechnicianEvent, updateTechnicianReportOffset } from "./crm-technicians";
import { matchTechnicianTicketDetail } from "./match-technician-ticket";
import type { MatchedWisproEmployee } from "./match-wispro-employee";
import { technicianDeliveryFollowUp } from "./technician-delivery-text";
import {
  looksLikeTechnicianNextPage,
  looksLikeTechnicianResend,
  parseTechnicianTicketDetailQuery,
  technicianFirstName,
} from "./technician-identity";
import {
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
});

const loadPendingCasos = async (
  supabase: SupabaseClient,
  employeeId: string,
): Promise<
  { casos: CrmWisproCaso[]; message?: undefined } | { casos: null; message: string }
> => {
  try {
    return { casos: await listPendingCasosForEmployee(supabase, employeeId) };
  } catch (error) {
    return {
      casos: null,
      message:
        error instanceof Error
          ? error.message
          : "No se pudieron leer los tickets pendientes",
    };
  }
};

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
}): Promise<TechnicianTicketDelivery> => {
  const loaded = await loadPendingCasos(input.supabase, input.employee.id);
  if (!loaded.casos) {
    return emptyDelivery({ message: loaded.message || "No se pudieron leer los tickets pendientes" });
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
    return emptyDelivery({
      ok: true,
      message:
        offset > 0
          ? "No hay más tickets en este lote."
          : `Hola ${firstName}, no tienes tickets pendientes asignados.`,
    });
  }

  const remaining = Math.max(0, all.length - offset - page.length);
  const reports = page.map(toTechnicianReport);

  try {
    await sendWhatsAppText({
      to: input.to,
      body: formatTechnicianList(reports, { startIndex: offset, remaining }),
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
