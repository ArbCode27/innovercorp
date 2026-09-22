"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import {
  ArrowDown,
  ArrowUp,
  ArrowUpDown,
  CheckCircle2,
  Eye,
  ExternalLink,
  Pencil,
  Plus,
  RefreshCw,
  Trash2,
  UserRoundPen,
} from "lucide-react";
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
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { CRM_SURFACES } from "../../_lib/crm-theme";
import { EmployeePicker } from "../wispro/employee-picker";
import { CrearCasoWisproDialog } from "../wispro/crear-caso-wispro-dialog";
import { TicketDetailDialog } from "./ticket-detail-dialog";
import { TicketFilters } from "./ticket-filters";
import { TicketEditDialog } from "./ticket-edit-dialog";
import { PriorityBadge } from "./priority-badge";
import { wisproCasoClient } from "../../_lib/wispro-caso-client";
import type { CrmWisproCaso, WisproEmployee } from "@/lib/wispro-types";
import { resolveMapsUrl } from "@/lib/maps-link";
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

const casoMapsUrl = (caso: CrmWisproCaso) =>
  resolveMapsUrl({
    mapsUrl: caso.mapsUrl,
    latitude: caso.latitude,
    longitude: caso.longitude,
  });

const TicketLocationCell = ({ caso }: { caso: CrmWisproCaso }) => {
  const address = caso.addressText?.trim() || null;
  const mapsUrl = casoMapsUrl(caso);

  if (!address && !mapsUrl) {
    return <span className={CRM_SURFACES.textMuted}>—</span>;
  }

  return (
    <div className="max-w-[240px] space-y-0.5">
      {address ? (
        <p className="line-clamp-2" title={address}>
          {address}
        </p>
      ) : null}
      {mapsUrl ? (
        <a
          href={mapsUrl}
          target="_blank"
          rel="noreferrer"
          className="inline-flex items-center gap-1 text-xs underline"
          aria-label={`Abrir Maps de ${caso.clientName || "el cliente"}`}>
          Maps
          <ExternalLink className="size-3" />
        </a>
      ) : null}
    </div>
  );
};

export const WisproIssuesPanel = () => {
  const [casos, setCasos] = useState<CrmWisproCaso[]>([]);
  const [employees, setEmployees] = useState<WisproEmployee[]>([]);
  const [error, setError] = useState<string | null>(null);
  const [isLoading, setIsLoading] = useState(false);
  const [busyIssueId, setBusyIssueId] = useState<string | null>(null);
  const [finalizeCaso, setFinalizeCaso] = useState<CrmWisproCaso | null>(null);
  const [reassignCaso, setReassignCaso] = useState<CrmWisproCaso | null>(null);
  const [editingCaso, setEditingCaso] = useState<CrmWisproCaso | null>(null);
  const [deletingCaso, setDeletingCaso] = useState<CrmWisproCaso | null>(null);
  const [isDeleting, setIsDeleting] = useState(false);
  const [detailCaso, setDetailCaso] = useState<CrmWisproCaso | null>(null);
  const [reassignEmployeeId, setReassignEmployeeId] = useState("");
  const [isCreateOpen, setIsCreateOpen] = useState(false);

  // Filtros
  const [searchQuery, setSearchQuery] = useState("");
  const [statusFilter, setStatusFilter] = useState("all");
  const [priorityFilter, setPriorityFilter] = useState("all");
  const [employeeFilter, setEmployeeFilter] = useState("all");
  const [sortOrder, setSortOrder] = useState<"desc" | "asc">("desc");

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
    const catalog = await wisproCasoClient.loadCatalog();
    setEmployees(catalog.employees);
    return catalog.employees;
  }, [employees.length]);

  useEffect(() => {
    void loadCasos();
    void loadEmployees();
  }, [loadCasos, loadEmployees]);

  const replaceCaso = (next: CrmWisproCaso) => {
    setCasos((current) =>
      current.map((caso) =>
        caso.wisproIssueId === next.wisproIssueId ? next : caso,
      ),
    );
  };

  const handleSavedEdit = (next: CrmWisproCaso) => {
    replaceCaso(next);
    if (detailCaso?.wisproIssueId === next.wisproIssueId) {
      setDetailCaso(next);
    }
  };

  const handleOpenEdit = async (caso: CrmWisproCaso) => {
    setEditingCaso(caso);
    try {
      await loadEmployees();
    } catch {
      // Ignorar si ya cargó
    }
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
            "El ticket se cerró, pero la orden no se pudo finalizar.",
        );
      } else {
        toast.success("Ticket finalizado.");
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
      toast.success("Técnico reasignado.");
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

  const handleDelete = async () => {
    if (!deletingCaso) return;
    setIsDeleting(true);
    try {
      await wisproCasoClient.deleteCaso(deletingCaso.wisproIssueId);
      setCasos((current) =>
        current.filter((c) => c.wisproIssueId !== deletingCaso.wisproIssueId),
      );
      if (detailCaso?.wisproIssueId === deletingCaso.wisproIssueId) {
        setDetailCaso(null);
      }
      toast.success("Ticket eliminado correctamente.");
      setDeletingCaso(null);
    } catch (deleteError) {
      toast.error(
        deleteError instanceof Error
          ? deleteError.message
          : "No se pudo eliminar el ticket",
      );
    } finally {
      setIsDeleting(false);
    }
  };

  const handleResetFilters = () => {
    setSearchQuery("");
    setStatusFilter("all");
    setPriorityFilter("all");
    setEmployeeFilter("all");
  };

  const handleToggleSort = () => {
    setSortOrder((current) => (current === "desc" ? "asc" : "desc"));
  };

  const statusCounts = useMemo(() => {
    const counts: Record<string, number> = {
      all: casos.length,
      open: 0,
      scheduled: 0,
      done: 0,
      cancelled: 0,
    };
    for (const caso of casos) {
      if (caso.status in counts) {
        counts[caso.status]++;
      }
    }
    return counts;
  }, [casos]);

  const filteredCasos = useMemo(() => {
    return casos
      .filter((caso) => {
        if (searchQuery.trim()) {
          const q = searchQuery.toLowerCase().trim();
          const publicId = caso.wisproPublicId != null ? `#${caso.wisproPublicId}` : "";
          const clientName = caso.clientName?.toLowerCase() || "";
          const clientPhone = caso.clientPhone?.toLowerCase() || "";
          const title = caso.title?.toLowerCase() || "";
          const cause = caso.cause?.toLowerCase() || "";
          const employeeName = caso.employeeName?.toLowerCase() || "";
          const address = caso.addressText?.toLowerCase() || "";

          const matches =
            publicId.includes(q) ||
            clientName.includes(q) ||
            clientPhone.includes(q) ||
            title.includes(q) ||
            cause.includes(q) ||
            employeeName.includes(q) ||
            address.includes(q);

          if (!matches) return false;
        }

        if (statusFilter !== "all" && caso.status !== statusFilter) {
          return false;
        }

        if (priorityFilter !== "all" && (caso.priority || "medium") !== priorityFilter) {
          return false;
        }

        if (employeeFilter !== "all") {
          if (employeeFilter === "unassigned") {
            if (caso.employeeId) return false;
          } else if (caso.employeeId !== employeeFilter) {
            return false;
          }
        }

        return true;
      })
      .sort((a, b) => {
        const timeA = a.createdAt ? new Date(a.createdAt).getTime() : 0;
        const timeB = b.createdAt ? new Date(b.createdAt).getTime() : 0;
        return sortOrder === "desc" ? timeB - timeA : timeA - timeB;
      });
  }, [casos, searchQuery, statusFilter, priorityFilter, employeeFilter, sortOrder]);

  return (
    <section className="space-y-4">
      <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <h2 className={`text-xl font-semibold md:text-2xl ${CRM_SURFACES.textPrimary}`}>
            Tickets
          </h2>
          <p className={`text-sm ${CRM_SURFACES.textMuted}`}>
            Gestión, asignación, prioridades y seguimiento de tickets en el CRM.
          </p>
        </div>
        <div className="flex flex-wrap items-center gap-2">
          <Button
            type="button"
            onClick={() => setIsCreateOpen(true)}
            className="w-full sm:w-auto">
            <Plus className="size-3.5" />
            Nuevo ticket
          </Button>
          <Button
            type="button"
            variant="secondary"
            onClick={() => void loadCasos()}
            disabled={isLoading}
            className="w-full sm:w-auto">
            <RefreshCw className={`size-3.5 ${isLoading ? "animate-spin" : ""}`} />
            {isLoading ? "Actualizando..." : "Actualizar"}
          </Button>
        </div>
      </div>

      <TicketFilters
        searchQuery={searchQuery}
        onSearchChange={setSearchQuery}
        statusFilter={statusFilter}
        onStatusChange={setStatusFilter}
        priorityFilter={priorityFilter}
        onPriorityChange={setPriorityFilter}
        employeeFilter={employeeFilter}
        onEmployeeChange={setEmployeeFilter}
        employees={employees}
        totalCount={casos.length}
        filteredCount={filteredCasos.length}
        statusCounts={statusCounts}
        onReset={handleResetFilters}
      />

      {error ? (
        <p className="rounded-2xl border border-red-300 bg-red-50 px-3 py-2 text-sm text-red-800 dark:border-red-500/40 dark:bg-red-950/40 dark:text-red-100">
          {error}
        </p>
      ) : null}

      <Card className="overflow-hidden py-0">
        <div className="overflow-x-auto">
          <Table className="min-w-[1220px]">
            <TableHeader>
              <TableRow className={`${CRM_SURFACES.border} hover:bg-transparent`}>
                <TableHead className={CRM_SURFACES.textMuted}>#</TableHead>
                <TableHead className={CRM_SURFACES.textMuted}>Prioridad</TableHead>
                <TableHead className={CRM_SURFACES.textMuted}>Cliente</TableHead>
                <TableHead className={CRM_SURFACES.textMuted}>Causa</TableHead>
                <TableHead className={CRM_SURFACES.textMuted}>Técnico</TableHead>
                <TableHead className={CRM_SURFACES.textMuted}>Ubicación</TableHead>
                <TableHead className={CRM_SURFACES.textMuted}>Fachada</TableHead>
                <TableHead className={CRM_SURFACES.textMuted}>Estado</TableHead>
                <TableHead className={CRM_SURFACES.textMuted}>
                  <button
                    type="button"
                    onClick={handleToggleSort}
                    className="inline-flex items-center gap-1 font-medium hover:text-slate-900 dark:hover:text-slate-100"
                    aria-label={`Ordenar por fecha de creación ${sortOrder === "desc" ? "ascendente" : "descendente"}`}>
                    <span>Creado</span>
                    {sortOrder === "desc" ? (
                      <ArrowDown className="size-3.5" />
                    ) : (
                      <ArrowUp className="size-3.5" />
                    )}
                  </button>
                </TableHead>
                <TableHead className={CRM_SURFACES.textMuted}>Acciones</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {filteredCasos.length ? (
                filteredCasos.map((caso) => {
                  const open = isOpenCaso(caso);
                  const busy = busyIssueId === caso.wisproIssueId;
                  return (
                    <TableRow
                      key={caso.id}
                      className={`${CRM_SURFACES.border} ${CRM_SURFACES.hover}`}>
                      <TableCell className={`font-mono text-sm ${CRM_SURFACES.textPrimary}`}>
                        {caso.wisproPublicId != null ? `#${caso.wisproPublicId}` : "—"}
                      </TableCell>
                      <TableCell>
                        <PriorityBadge priority={caso.priority} />
                      </TableCell>
                      <TableCell className={CRM_SURFACES.textSecondary}>
                        <p className="font-medium">{caso.clientName || "—"}</p>
                        <p className={`text-[11px] ${CRM_SURFACES.textMuted}`}>
                          {caso.clientPhone || "sin teléfono"}
                        </p>
                      </TableCell>
                      <TableCell className={CRM_SURFACES.textSecondary}>
                        <p className="line-clamp-2 max-w-[200px]" title={caso.cause || caso.title}>
                          {caso.cause || caso.title}
                        </p>
                      </TableCell>
                      <TableCell className={CRM_SURFACES.textSecondary}>
                        <p>{caso.employeeName || "sin asignar"}</p>
                        {caso.employeeDocument ? (
                          <p className={`text-[11px] ${CRM_SURFACES.textMuted}`}>
                            CI {caso.employeeDocument}
                          </p>
                        ) : null}
                      </TableCell>
                      <TableCell className={CRM_SURFACES.textSecondary}>
                        <TicketLocationCell caso={caso} />
                      </TableCell>
                      <TableCell className={CRM_SURFACES.textSecondary}>
                        {hasFacade(caso) ? "Sí" : "No"}
                      </TableCell>
                      <TableCell className={CRM_SURFACES.textSecondary}>
                        {statusLabel[caso.status] || caso.status}
                      </TableCell>
                      <TableCell className={`text-xs ${CRM_SURFACES.textMuted}`}>
                        {formatCrmDate(caso.createdAt)}
                      </TableCell>
                      <TableCell>
                        <div className="flex flex-wrap items-center gap-1.5">
                          <Button
                            type="button"
                            variant="secondary"
                            size="sm"
                            aria-label={`Ver detalle del ticket ${caso.wisproPublicId ?? ""}`}
                            onClick={() => setDetailCaso(caso)}>
                            <Eye className="size-3.5" />
                            Detalle
                          </Button>
                          <Button
                            type="button"
                            variant="secondary"
                            size="sm"
                            aria-label={`Editar ticket ${caso.wisproPublicId ?? ""}`}
                            onClick={() => void handleOpenEdit(caso)}>
                            <Pencil className="size-3.5" />
                            Editar
                          </Button>
                          {open ? (
                            <>
                              <Button
                                type="button"
                                variant="success"
                                size="sm"
                                disabled={busy}
                                aria-label={`Finalizar ticket ${caso.wisproPublicId ?? ""}`}
                                onClick={() => setFinalizeCaso(caso)}>
                                <CheckCircle2 className="size-3.5" />
                                Finalizar
                              </Button>
                              <Button
                                type="button"
                                variant="secondary"
                                size="sm"
                                disabled={busy}
                                aria-label={`Reasignar ticket ${caso.wisproPublicId ?? ""}`}
                                onClick={() => void handleOpenReassign(caso)}>
                                <UserRoundPen className="size-3.5" />
                                Reasignar
                              </Button>
                            </>
                          ) : null}
                          <Button
                            type="button"
                            variant="ghost"
                            size="sm"
                            disabled={busy}
                            className="text-red-600 hover:bg-red-50 hover:text-red-700 dark:text-red-400 dark:hover:bg-red-950/40 dark:hover:text-red-300"
                            aria-label={`Eliminar ticket ${caso.wisproPublicId ?? ""}`}
                            onClick={() => setDeletingCaso(caso)}>
                            <Trash2 className="size-3.5" />
                          </Button>
                        </div>
                      </TableCell>
                    </TableRow>
                  );
                })
              ) : (
                <TableRow className={CRM_SURFACES.border}>
                  <TableCell
                    colSpan={10}
                    className={`h-24 text-center ${CRM_SURFACES.textMuted}`}>
                    {isLoading
                      ? "Cargando tickets..."
                      : casos.length === 0
                        ? "Todavía no hay tickets. Crea uno con Nuevo ticket."
                        : "No se encontraron tickets con los filtros aplicados."}
                  </TableCell>
                </TableRow>
              )}
            </TableBody>
          </Table>
        </div>
      </Card>

      <Dialog
        open={Boolean(finalizeCaso)}
        onOpenChange={(open) => {
          if (!open) setFinalizeCaso(null);
        }}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Finalizar ticket</DialogTitle>
            <DialogDescription>
              Se cerrará el ticket{" "}
              {finalizeCaso?.wisproPublicId != null
                ? `#${finalizeCaso.wisproPublicId}`
                : ""}{" "}
              en el CRM.
            </DialogDescription>
          </DialogHeader>
          <DialogFooter className="mt-4 gap-2">
            <Button
              type="button"
              variant="secondary"
              onClick={() => setFinalizeCaso(null)}
              disabled={Boolean(busyIssueId)}>
              Cancelar
            </Button>
            <Button
              type="button"
              variant="success"
              onClick={() => void handleFinalize()}
              disabled={Boolean(busyIssueId)}>
              {busyIssueId ? "Finalizando..." : "Finalizar"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <Dialog
        open={Boolean(reassignCaso)}
        onOpenChange={(open) => {
          if (!open) setReassignCaso(null);
        }}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Reasignar técnico</DialogTitle>
            <DialogDescription>
              El ticket{" "}
              {reassignCaso?.wisproPublicId != null
                ? `#${reassignCaso.wisproPublicId}`
                : ""}{" "}
              quedará asignado al técnico elegido.
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
            <Button
              type="button"
              variant="secondary"
              onClick={() => setReassignCaso(null)}
              disabled={Boolean(busyIssueId)}>
              Cancelar
            </Button>
            <Button
              type="button"
              onClick={() => void handleReassign()}
              disabled={Boolean(busyIssueId) || !reassignEmployeeId}>
              {busyIssueId ? "Reasignando..." : "Reasignar"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Diálogo de edición */}
      <TicketEditDialog
        caso={editingCaso}
        open={Boolean(editingCaso)}
        onOpenChange={(open) => {
          if (!open) setEditingCaso(null);
        }}
        onSaved={handleSavedEdit}
        employees={employees}
      />

      {/* Diálogo de confirmación para eliminar */}
      <AlertDialog
        open={Boolean(deletingCaso)}
        onOpenChange={(open) => {
          if (!open && !isDeleting) setDeletingCaso(null);
        }}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>¿Eliminar este ticket?</AlertDialogTitle>
            <AlertDialogDescription>
              Esta acción eliminará el ticket{" "}
              <strong className="text-foreground">
                {deletingCaso?.wisproPublicId != null
                  ? `#${deletingCaso.wisproPublicId}`
                  : "seleccionado"}
              </strong>
              {deletingCaso?.clientName ? ` de ${deletingCaso.clientName}` : ""} del
              CRM. Esta acción no se puede deshacer.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel disabled={isDeleting}>Cancelar</AlertDialogCancel>
            <AlertDialogAction
              onClick={() => void handleDelete()}
              disabled={isDeleting}
              className="bg-red-600 text-white hover:bg-red-700 dark:bg-red-700 dark:hover:bg-red-800">
              {isDeleting ? "Eliminando..." : "Eliminar ticket"}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      <TicketDetailDialog
        caso={detailCaso}
        onOpenChange={(open) => {
          if (!open) setDetailCaso(null);
        }}
        onEdit={(caso) => void handleOpenEdit(caso)}
      />

      <CrearCasoWisproDialog
        open={isCreateOpen}
        onOpenChange={setIsCreateOpen}
        onCreated={() => void loadCasos()}
      />
    </section>
  );
};
