"use client";

import { useCallback, useEffect, useState } from "react";
import { CheckCircle2, ExternalLink, RefreshCw, UserRoundPen } from "lucide-react";
import { toast } from "sonner";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { CRM_DIALOG, CRM_SURFACES, CRM_TABLE } from "../../_lib/crm-theme";
import { CrmButton } from "../shared/crm-button";
import { EmployeePicker } from "../wispro/employee-picker";
import { wisproCasoClient } from "../../_lib/wispro-caso-client";
import type { CrmWisproCaso, WisproEmployee } from "@/lib/wispro-types";
import { formatCrmDate } from "../../_lib/formatters";

const statusLabel: Record<CrmWisproCaso["status"], string> = {
  open: "Abierto",
  scheduled: "Agendado",
  done: "Cerrado",
  cancelled: "Cancelado",
};

const isOpenCaso = (caso: CrmWisproCaso) =>
  caso.status === "open" || caso.status === "scheduled";

const hasFacade = (caso: CrmWisproCaso) =>
  Boolean(caso.hasFacade || caso.facadeMediaUrl);

export const WisproIssuesPanel = () => {
  const [casos, setCasos] = useState<CrmWisproCaso[]>([]);
  const [employees, setEmployees] = useState<WisproEmployee[]>([]);
  const [error, setError] = useState<string | null>(null);
  const [isLoading, setIsLoading] = useState(false);
  const [busyIssueId, setBusyIssueId] = useState<string | null>(null);
  const [finalizeCaso, setFinalizeCaso] = useState<CrmWisproCaso | null>(null);
  const [reassignCaso, setReassignCaso] = useState<CrmWisproCaso | null>(null);
  const [reassignEmployeeId, setReassignEmployeeId] = useState("");

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

  const loadEmployees = useCallback(async () => {
    if (employees.length) return employees;
    const catalog = await wisproCasoClient.loadCatalog({ allEmployees: true });
    setEmployees(catalog.employees);
    return catalog.employees;
  }, [employees.length]);

  useEffect(() => {
    void loadCasos();
  }, [loadCasos]);

  const replaceCaso = (next: CrmWisproCaso) => {
    setCasos((current) =>
      current.map((caso) =>
        caso.wisproIssueId === next.wisproIssueId ? next : caso,
      ),
    );
  };

  const handleFinalize = async () => {
    if (!finalizeCaso) return;
    setBusyIssueId(finalizeCaso.wisproIssueId);
    try {
      const result = await wisproCasoClient.manageCaso({
        action: "finalize",
        issueId: finalizeCaso.wisproIssueId,
      });
      if (result.caso) replaceCaso(result.caso);
      if (result.orden?.ok === false) {
        toast.warning(
          result.orden.error ||
            "El ticket se cerró en CRM y Wispro, pero la orden no se pudo finalizar.",
        );
      } else {
        toast.success("Ticket finalizado en CRM y Wispro.");
      }
      setFinalizeCaso(null);
    } catch (finalizeError) {
      toast.error(
        finalizeError instanceof Error
          ? finalizeError.message
          : "No se pudo finalizar el ticket",
      );
    } finally {
      setBusyIssueId(null);
    }
  };

  const handleOpenReassign = async (caso: CrmWisproCaso) => {
    setReassignCaso(caso);
    setReassignEmployeeId(caso.employeeId || "");
    try {
      await loadEmployees();
    } catch (catalogError) {
      toast.error(
        catalogError instanceof Error
          ? catalogError.message
          : "No se cargaron los técnicos",
      );
    }
  };

  const handleReassign = async () => {
    if (!reassignCaso || !reassignEmployeeId) return;
    if (reassignEmployeeId === reassignCaso.employeeId) {
      setReassignCaso(null);
      return;
    }
    setBusyIssueId(reassignCaso.wisproIssueId);
    try {
      const result = await wisproCasoClient.manageCaso({
        action: "reassign",
        issueId: reassignCaso.wisproIssueId,
        employeeId: reassignEmployeeId,
      });
      if (result.caso) replaceCaso(result.caso);
      toast.success("Técnico reasignado en CRM y Wispro.");
      setReassignCaso(null);
    } catch (reassignError) {
      toast.error(
        reassignError instanceof Error
          ? reassignError.message
          : "No se pudo reasignar el ticket",
      );
    } finally {
      setBusyIssueId(null);
    }
  };

  return (
    <section className="space-y-3">
      <div className="flex items-center justify-between gap-3">
        <div>
          <h3 className={`text-base font-semibold ${CRM_SURFACES.textPrimary}`}>
            Tickets Wispro
          </h3>
          <p className={`text-xs ${CRM_SURFACES.textMuted}`}>
            Ficha local del chat: fachada, Maps y técnico. Nova usa esta misma ficha.
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
          <Table className="min-w-[1080px]">
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
                <TableHead className={CRM_SURFACES.textMuted}>Acciones</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {casos.length ? (
                casos.map((caso) => {
                  const open = isOpenCaso(caso);
                  const busy = busyIssueId === caso.wisproIssueId;
                  return (
                    <TableRow
                      key={caso.id}
                      className={`${CRM_SURFACES.border} ${CRM_SURFACES.hover}`}>
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
                      <TableCell className={CRM_SURFACES.textSecondary}>
                        {hasFacade(caso) ? "Sí" : "No"}
                      </TableCell>
                      <TableCell className={CRM_SURFACES.textSecondary}>
                        {statusLabel[caso.status] || caso.status}
                      </TableCell>
                      <TableCell className={CRM_SURFACES.textMuted}>
                        {formatCrmDate(caso.createdAt)}
                      </TableCell>
                      <TableCell>
                        {open ? (
                          <div className="flex flex-wrap gap-2">
                            <CrmButton
                              type="button"
                              variant="success"
                              size="sm"
                              disabled={busy}
                              aria-label={`Finalizar ticket ${caso.wisproPublicId ?? ""}`}
                              onClick={() => setFinalizeCaso(caso)}>
                              <CheckCircle2 className="size-3.5" />
                              Finalizar
                            </CrmButton>
                            <CrmButton
                              type="button"
                              variant="secondary"
                              size="sm"
                              disabled={busy}
                              aria-label={`Reasignar ticket ${caso.wisproPublicId ?? ""}`}
                              onClick={() => void handleOpenReassign(caso)}>
                              <UserRoundPen className="size-3.5" />
                              Reasignar
                            </CrmButton>
                          </div>
                        ) : (
                          <span className={CRM_SURFACES.textMuted}>—</span>
                        )}
                      </TableCell>
                    </TableRow>
                  );
                })
              ) : (
                <TableRow className={CRM_SURFACES.border}>
                  <TableCell
                    colSpan={9}
                    className={`h-20 text-center ${CRM_SURFACES.textMuted}`}>
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

      <Dialog
        open={Boolean(finalizeCaso)}
        onOpenChange={(open) => {
          if (!open) setFinalizeCaso(null);
        }}>
        <DialogContent className={CRM_DIALOG}>
          <DialogHeader>
            <DialogTitle>Finalizar ticket</DialogTitle>
            <DialogDescription>
              Se cerrará el ticket{" "}
              {finalizeCaso?.wisproPublicId != null
                ? `#${finalizeCaso.wisproPublicId}`
                : ""}{" "}
              en el CRM y en Wispro.
            </DialogDescription>
          </DialogHeader>
          <DialogFooter className="mt-4 gap-2">
            <CrmButton
              type="button"
              variant="secondary"
              onClick={() => setFinalizeCaso(null)}
              disabled={Boolean(busyIssueId)}>
              Cancelar
            </CrmButton>
            <CrmButton
              type="button"
              variant="success"
              onClick={() => void handleFinalize()}
              disabled={Boolean(busyIssueId)}>
              {busyIssueId ? "Finalizando..." : "Finalizar"}
            </CrmButton>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <Dialog
        open={Boolean(reassignCaso)}
        onOpenChange={(open) => {
          if (!open) setReassignCaso(null);
        }}>
        <DialogContent className={CRM_DIALOG}>
          <DialogHeader>
            <DialogTitle>Reasignar técnico</DialogTitle>
            <DialogDescription>
              El ticket{" "}
              {reassignCaso?.wisproPublicId != null
                ? `#${reassignCaso.wisproPublicId}`
                : ""}{" "}
              quedará asignado al técnico elegido en el CRM y en Wispro.
            </DialogDescription>
          </DialogHeader>
          <div className="mt-4">
            <EmployeePicker
              employees={employees}
              value={reassignEmployeeId}
              onChange={setReassignEmployeeId}
              disabled={Boolean(busyIssueId)}
            />
          </div>
          <DialogFooter className="mt-4 gap-2">
            <CrmButton
              type="button"
              variant="secondary"
              onClick={() => setReassignCaso(null)}
              disabled={Boolean(busyIssueId)}>
              Cancelar
            </CrmButton>
            <CrmButton
              type="button"
              onClick={() => void handleReassign()}
              disabled={Boolean(busyIssueId) || !reassignEmployeeId}>
              {busyIssueId ? "Reasignando..." : "Reasignar"}
            </CrmButton>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </section>
  );
};
