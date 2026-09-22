"use client";

import { useEffect, useState, type ReactNode } from "react";
import { ExternalLink, Pencil } from "lucide-react";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { CRM_SURFACES } from "../../_lib/crm-theme";
import { wisproCasoClient } from "../../_lib/wispro-caso-client";
import { orderKindLabels } from "../../_lib/wispro-caso-schema";
import { formatCrmDate } from "../../_lib/formatters";
import { resolveMapsUrl } from "@/lib/maps-link";
import { PriorityBadge } from "./priority-badge";
import type { CrmWisproCaso } from "@/lib/wispro-types";

const statusLabel: Record<CrmWisproCaso["status"], string> = {
  open: "Abierto",
  scheduled: "Agendado",
  done: "Cerrado",
  cancelled: "Cancelado",
};

const kindLabel = (caso: CrmWisproCaso) => {
  if (caso.kind && caso.kind in orderKindLabels) {
    return orderKindLabels[caso.kind as keyof typeof orderKindLabels];
  }
  return caso.kind?.trim() || "Visita técnica";
};

const formatWindow = (start: string | null, end: string | null) => {
  if (!start && !end) return null;
  if (start && end) return `${formatCrmDate(start)} – ${formatCrmDate(end)}`;
  return formatCrmDate(start || end);
};

const DetailField = ({
  label,
  children,
}: {
  label: string;
  children: ReactNode;
}) => (
  <div>
    <p
      className={`text-[11px] font-medium uppercase tracking-wide ${CRM_SURFACES.textMuted}`}>
      {label}
    </p>
    <div className={`mt-0.5 text-sm ${CRM_SURFACES.textPrimary}`}>{children}</div>
  </div>
);

const ticketTitle = (caso: CrmWisproCaso) =>
  caso.wisproPublicId != null ? `Ticket #${caso.wisproPublicId}` : "Ticket";

type TicketDetailDialogProps = {
  caso: CrmWisproCaso | null;
  onOpenChange: (open: boolean) => void;
  onEdit?: (caso: CrmWisproCaso) => void;
};

export const TicketDetailDialog = ({
  caso,
  onOpenChange,
  onEdit,
}: TicketDetailDialogProps) => {
  const [detail, setDetail] = useState<CrmWisproCaso | null>(caso);
  const [imageFailed, setImageFailed] = useState(false);

  useEffect(() => {
    if (!caso) {
      setDetail(null);
      setImageFailed(false);
      return;
    }

    setDetail(caso);
    setImageFailed(false);
    let cancelled = false;

    const loadDetail = async () => {
      try {
        const next = await wisproCasoClient.getCrmCaso(caso.wisproIssueId);
        if (!cancelled) setDetail(next);
      } catch {
        if (!cancelled) setDetail(caso);
      }
    };

    void loadDetail();
    return () => {
      cancelled = true;
    };
  }, [caso]);

  const mapsUrl = detail
    ? resolveMapsUrl({
        mapsUrl: detail.mapsUrl,
        latitude: detail.latitude,
        longitude: detail.longitude,
      })
    : null;
  const windowLabel = detail
    ? formatWindow(detail.windowStart, detail.windowEnd)
    : null;
  const facadeUrl = detail?.facadeMediaUrl?.trim() || null;

  return (
    <Dialog
      open={Boolean(caso)}
      onOpenChange={(open) => {
        if (!open) onOpenChange(false);
      }}>
      <DialogContent className="flex max-h-[90vh] flex-col overflow-hidden sm:max-w-2xl">
        <DialogHeader>
          <div className="flex flex-wrap items-center gap-2">
            <DialogTitle>{detail ? ticketTitle(detail) : "Ticket"}</DialogTitle>
            {detail ? <PriorityBadge priority={detail.priority} /> : null}
          </div>
          <DialogDescription>
            {detail
              ? `${statusLabel[detail.status] || detail.status} · ${kindLabel(detail)}`
              : "Ficha del caso"}
          </DialogDescription>
        </DialogHeader>

        {detail ? (
          <div className="crm-scrollbar min-h-0 flex-1 space-y-4 overflow-y-auto pr-1">
            <div className="grid gap-4 sm:grid-cols-2">
              <DetailField label="Cliente">
                <p>{detail.clientName || "N/D"}</p>
                {detail.clientPhone ? (
                  <a
                    href={`tel:${detail.clientPhone}`}
                    className={`text-xs underline ${CRM_SURFACES.textSecondary}`}>
                    {detail.clientPhone}
                  </a>
                ) : (
                  <p className={`text-xs ${CRM_SURFACES.textMuted}`}>
                    Sin teléfono
                  </p>
                )}
              </DetailField>
              <DetailField label="Técnico">
                <p>{detail.employeeName || "Sin asignar"}</p>
                {detail.employeeDocument ? (
                  <p className={`text-xs ${CRM_SURFACES.textMuted}`}>
                    CI {detail.employeeDocument}
                  </p>
                ) : null}
                {detail.employeePhone ? (
                  <p className={`text-xs ${CRM_SURFACES.textMuted}`}>
                    {detail.employeePhone}
                  </p>
                ) : null}
              </DetailField>
              <DetailField label="Prioridad">
                <div className="pt-0.5">
                  <PriorityBadge priority={detail.priority} />
                </div>
              </DetailField>
              <DetailField label="Fecha de creación">
                <p>{formatCrmDate(detail.createdAt)}</p>
              </DetailField>
              <DetailField label="Causa">
                {detail.cause || detail.title || "N/D"}
              </DetailField>
              <DetailField label="Ventana">
                {windowLabel || "Sin ventana"}
              </DetailField>
            </div>

            <DetailField label="Ubicación">
              {detail.addressText?.trim() ? (
                <p>{detail.addressText.trim()}</p>
              ) : (
                <p className={CRM_SURFACES.textMuted}>Sin dirección</p>
              )}
              {mapsUrl ? (
                <a
                  href={mapsUrl}
                  target="_blank"
                  rel="noreferrer"
                  className="mt-1 inline-flex items-center gap-1 text-xs underline"
                  aria-label={`Abrir Maps de ${detail.clientName || "el cliente"}`}>
                  Abrir en Maps
                  <ExternalLink className="size-3" />
                </a>
              ) : null}
            </DetailField>

            {detail.description?.trim() ? (
              <DetailField label="Descripción">
                <p className="whitespace-pre-wrap">{detail.description.trim()}</p>
              </DetailField>
            ) : null}

            <DetailField label="Fachada">
              {facadeUrl && !imageFailed ? (
                // eslint-disable-next-line @next/next/no-img-element
                <img
                  src={facadeUrl}
                  alt={`Fachada de ${detail.clientName || "el cliente"}`}
                  className="mt-1 max-h-72 w-full rounded-xl object-cover"
                  onError={() => setImageFailed(true)}
                />
              ) : detail.hasFacade || facadeUrl ? (
                <p className={CRM_SURFACES.textMuted}>
                  Hay foto de fachada, pero no se pudo mostrar.
                </p>
              ) : (
                <p className={CRM_SURFACES.textMuted}>Sin foto de fachada</p>
              )}
            </DetailField>

            <p className={`text-xs ${CRM_SURFACES.textMuted}`}>
              Creado {formatCrmDate(detail.createdAt)}
              {detail.updatedAt ? ` · Actualizado ${formatCrmDate(detail.updatedAt)}` : ""}
            </p>
          </div>
        ) : null}

        <DialogFooter className="flex flex-col-reverse gap-2 sm:flex-row sm:justify-end">
          <Button type="button" variant="secondary" onClick={() => onOpenChange(false)}>
            Cerrar
          </Button>
          {onEdit && detail ? (
            <Button
              type="button"
              onClick={() => {
                onOpenChange(false);
                onEdit(detail);
              }}>
              <Pencil className="size-3.5" />
              Editar ticket
            </Button>
          ) : null}
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
};
