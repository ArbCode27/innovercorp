import type { SupabaseClient } from "@supabase/supabase-js";
import { orderKindLabels } from "@/app/crm/_lib/wispro-caso-schema";
import { listPendingCasosForEmployee } from "./crm-wispro-casos";
import { recordTechnicianEvent, updateTechnicianReportOffset } from "./crm-technicians";
import type { MatchedWisproEmployee } from "./match-wispro-employee";
import { technicianDeliveryFollowUp } from "./technician-delivery-text";
import {
  looksLikeTechnicianNextPage,
  looksLikeTechnicianResend,
  technicianFirstName,
} from "./technician-identity";
import {
  formatTechnicianCaption,
  formatTechnicianList,
} from "./technician-report";
import {
  sendWhatsAppImageFromUrl,
  sendWhatsAppText,
} from "./whatsapp-outbound";
import type { CrmWisproCaso } from "./wispro-types";

const PAGE_SIZE = 8;
const DEDUPE_WINDOW_MS = 2 * 60 * 60 * 1000;

export const TECHNICIAN_TOOL_NAMES = [
  "list_my_pending_tickets",
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

const reportKey = (employeeId: string, caso: CrmWisproCaso) =>
  `${employeeId}:${caso.id}:${caso.updatedAt || ""}`;

const toTechnicianReport = (caso: CrmWisproCaso) => ({
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

const markReported = async (
  supabase: SupabaseClient,
  employeeId: string,
  casos: CrmWisproCaso[],
) => {
  const now = new Date().toISOString();
  await Promise.all(
    casos.map((caso) =>
      supabase
        .from("crm_wispro_casos")
        .update({
          last_technician_report_at: now,
          last_technician_report_key: reportKey(employeeId, caso),
        })
        .eq("id", caso.id),
    ),
  );
};

const filterUnsent = (
  employeeId: string,
  casos: CrmWisproCaso[],
  force: boolean,
) => {
  if (force) return casos;
  const cutoff = Date.now() - DEDUPE_WINDOW_MS;
  return casos.filter((caso) => {
    const key = caso.lastTechnicianReportKey;
    const reportedAt = caso.lastTechnicianReportAt;
    if (!key || key !== reportKey(employeeId, caso) || !reportedAt) return true;
    return Date.parse(reportedAt) < cutoff;
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
  const force = looksLikeTechnicianResend(input.inboundText);
  let all: CrmWisproCaso[];
  try {
    all = await listPendingCasosForEmployee(input.supabase, input.employee.id);
  } catch (error) {
    return {
      ok: false,
      identified: true,
      message:
        error instanceof Error
          ? error.message
          : "No se pudieron leer los tickets pendientes",
      count: 0,
      delivered: 0,
      remaining: 0,
      offset: 0,
    };
  }

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
    return {
      ok: true,
      identified: true,
      message:
        offset > 0
          ? "No hay más tickets en este lote."
          : `Hola ${firstName}, no tienes tickets pendientes asignados.`,
      count: 0,
      delivered: 0,
      remaining: 0,
      offset: 0,
    };
  }

  const sendable = filterUnsent(input.employee.id, page, force);
  if (!sendable.length) {
    const remaining = Math.max(0, all.length - offset - page.length);
    await updateTechnicianReportOffset(
      input.supabase,
      input.conversationId,
      offset + page.length,
    );
    return {
      ok: true,
      identified: true,
      message: remaining
        ? `Ya te envié este lote. Quedan ${remaining}; escribe *siguiente* o *reenviar* si los necesitas de nuevo.`
        : "Ya te envié esos tickets. Escribe *reenviar* si los necesitas de nuevo.",
      count: all.length,
      delivered: 0,
      remaining,
      offset: offset + page.length,
    };
  }

  const reports = sendable.map(toTechnicianReport);
  let delivered = 0;
  const failures: string[] = [];

  try {
    if (reports.length > 1) {
      await sendWhatsAppText({
        to: input.to,
        body: formatTechnicianList(reports),
        supabase: input.supabase,
        conversationId: input.conversationId,
        metadata: { engine: "ai", action: "technician_report_index" },
      });
    }

    for (const report of reports) {
      const caption = formatTechnicianCaption(report);
      try {
        if (report.facadeMediaUrl) {
          await sendWhatsAppImageFromUrl({
            to: input.to,
            imageUrl: report.facadeMediaUrl,
            caption,
            supabase: input.supabase,
            conversationId: input.conversationId,
            metadata: {
              engine: "ai",
              action: "technician_report",
              ticket: report.wisproPublicId,
            },
          });
        } else {
          await sendWhatsAppText({
            to: input.to,
            body: caption,
            supabase: input.supabase,
            conversationId: input.conversationId,
            metadata: {
              engine: "ai",
              action: "technician_report",
              ticket: report.wisproPublicId,
            },
          });
        }
        delivered += 1;
      } catch (error) {
        failures.push(
          error instanceof Error ? error.message : "No se pudo enviar un ticket",
        );
        try {
          await sendWhatsAppText({
            to: input.to,
            body: caption,
            supabase: input.supabase,
            conversationId: input.conversationId,
            metadata: { engine: "ai", action: "technician_report_fallback" },
          });
          delivered += 1;
        } catch {
          // already recorded
        }
      }
    }
  } catch (error) {
    return {
      ok: false,
      identified: true,
      message:
        error instanceof Error
          ? error.message
          : "No se pudo enviar el reporte al técnico",
      count: all.length,
      delivered,
      remaining: Math.max(0, all.length - offset - page.length),
      offset,
    };
  }

  if (delivered > 0) {
    await markReported(input.supabase, input.employee.id, sendable);
  }

  const remaining = Math.max(0, all.length - offset - page.length);
  await updateTechnicianReportOffset(
    input.supabase,
    input.conversationId,
    offset + page.length,
  );

  await recordTechnicianEvent(input.supabase, {
    technicianId: input.technicianId ?? null,
    conversationId: input.conversationId,
    event: delivered > 0 ? "tickets_delivered" : "tickets_failed",
    method: force ? "resend" : "pending",
    metadata: {
      delivered,
      remaining,
      count: all.length,
      failures,
    },
  });

  return {
    ok: delivered > 0,
    identified: true,
    message: technicianDeliveryFollowUp({ delivered, remaining }),
    count: all.length,
    delivered,
    remaining,
    offset: offset + page.length,
  };
};
