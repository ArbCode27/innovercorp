"use client";

import { useCallback, useEffect, useState } from "react";
import { ExternalLink, RefreshCw } from "lucide-react";
import { toast } from "sonner";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { CRM_SURFACES, CRM_TABLE } from "../../_lib/crm-theme";
import { CrmButton } from "../shared/crm-button";
import { wisproCasoClient } from "../../_lib/wispro-caso-client";
import type { CrmWisproCaso } from "@/lib/wispro-types";
import { formatCrmDate } from "../../_lib/formatters";

const statusLabel: Record<CrmWisproCaso["status"], string> = {
  open: "Abierto",
  scheduled: "Agendado",
  done: "Cerrado",
  cancelled: "Cancelado",
};

export const WisproIssuesPanel = () => {
  const [casos, setCasos] = useState<CrmWisproCaso[]>([]);
  const [error, setError] = useState<string | null>(null);
  const [isLoading, setIsLoading] = useState(false);

  const loadCasos = useCallback(async () => {
    setIsLoading(true);
    try {
      const next = await wisproCasoClient.listCrmCasos();
      setCasos(next);
      setError(null);
    } catch (loadError) {
      const message =
        loadError instanceof Error
          ? loadError.message
          : "No se pudieron cargar los tickets";
      setError(message);
      toast.error(message);
    } finally {
      setIsLoading(false);
    }
  }, []);

  useEffect(() => {
    void loadCasos();
  }, [loadCasos]);

  return (
    <section className="space-y-3">
      <div className="flex items-center justify-between gap-3">
        <div>
          <h3 className={`text-base font-semibold ${CRM_SURFACES.textPrimary}`}>
            Tickets Wispro
          </h3>
          <p className={`text-xs ${CRM_SURFACES.textMuted}`}>
            Ficha local del chat: foto de fachada, Maps y técnico. Nova usa esta misma ficha.
          </p>
        </div>
        <CrmButton
          type="button"
          variant="secondary"
          size="sm"
          onClick={() => void loadCasos()}
          disabled={isLoading}>
          <RefreshCw className="size-3.5" />
          {isLoading ? "Actualizando..." : "Actualizar"}
        </CrmButton>
      </div>

      {error ? (
        <p className="rounded-2xl border border-red-300 bg-red-50 px-3 py-2 text-sm text-red-800 dark:border-red-500/40 dark:bg-red-950/40 dark:text-red-100">
          {error}
        </p>
      ) : null}

      <div className={CRM_TABLE}>
        <div className="overflow-x-auto">
          <Table className="min-w-[960px]">
            <TableHeader>
              <TableRow className={`${CRM_SURFACES.border} hover:bg-transparent`}>
                <TableHead className={CRM_SURFACES.textMuted}>#</TableHead>
                <TableHead className={CRM_SURFACES.textMuted}>Cliente</TableHead>
                <TableHead className={CRM_SURFACES.textMuted}>Causa</TableHead>
                <TableHead className={CRM_SURFACES.textMuted}>Técnico</TableHead>
                <TableHead className={CRM_SURFACES.textMuted}>Maps</TableHead>
                <TableHead className={CRM_SURFACES.textMuted}>Fachada</TableHead>
                <TableHead className={CRM_SURFACES.textMuted}>Estado</TableHead>
                <TableHead className={CRM_SURFACES.textMuted}>Creado</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {casos.length ? (
                casos.map((caso) => (
                  <TableRow key={caso.id} className={`${CRM_SURFACES.border} ${CRM_SURFACES.hover}`}>
                    <TableCell className={`font-mono text-sm ${CRM_SURFACES.textPrimary}`}>
                      {caso.wisproPublicId != null ? `#${caso.wisproPublicId}` : "—"}
                    </TableCell>
                    <TableCell className={CRM_SURFACES.textSecondary}>
                      <p>{caso.clientName || "—"}</p>
                      <p className={`text-[11px] ${CRM_SURFACES.textMuted}`}>
                        {caso.clientPhone || "sin teléfono"}
                      </p>
                    </TableCell>
                    <TableCell className={CRM_SURFACES.textSecondary}>
                      {caso.cause || caso.title}
                    </TableCell>
                    <TableCell className={CRM_SURFACES.textSecondary}>
                      <p>{caso.employeeName || "sin asignar"}</p>
                      {caso.employeeDocument ? (
                        <p className={`text-[11px] ${CRM_SURFACES.textMuted}`}>
                          CI {caso.employeeDocument}
                        </p>
                      ) : null}
                    </TableCell>
                    <TableCell>
                      {caso.mapsUrl ? (
                        <a
                          href={caso.mapsUrl}
                          target="_blank"
                          rel="noreferrer"
                          className="inline-flex items-center gap-1 text-xs underline"
                          aria-label={`Abrir Maps del ticket ${caso.wisproPublicId ?? ""}`}>
                          Abrir
                          <ExternalLink className="size-3" />
                        </a>
                      ) : (
                        <span className={CRM_SURFACES.textMuted}>—</span>
                      )}
                    </TableCell>
                    <TableCell>
                      {caso.facadeMediaUrl ? (
                        // eslint-disable-next-line @next/next/no-img-element
                        <img
                          src={caso.facadeMediaUrl}
                          alt={`Fachada ticket ${caso.wisproPublicId ?? ""}`}
                          className="h-10 w-14 rounded-md object-cover"
                        />
                      ) : (
                        <span className={CRM_SURFACES.textMuted}>—</span>
                      )}
                    </TableCell>
                    <TableCell className={CRM_SURFACES.textSecondary}>
                      {statusLabel[caso.status] || caso.status}
                    </TableCell>
                    <TableCell className={CRM_SURFACES.textMuted}>
                      {formatCrmDate(caso.createdAt)}
                    </TableCell>
                  </TableRow>
                ))
              ) : (
                <TableRow className={CRM_SURFACES.border}>
                  <TableCell colSpan={8} className={`h-20 text-center ${CRM_SURFACES.textMuted}`}>
                    {isLoading
                      ? "Cargando tickets..."
                      : "Todavía no hay fichas locales. Crea el ticket desde el chat del cliente."}
                  </TableCell>
                </TableRow>
              )}
            </TableBody>
          </Table>
        </div>
      </div>
    </section>
  );
};
