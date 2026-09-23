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
  X,
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
import { Checkbox } from "@/components/ui/checkbox";
import { CRM_SURFACES } from "../../_lib/crm-theme";
import { EmployeePicker } from "../wispro/employee-picker";
import { CrearCasoWisproDialog } from "../wispro/crear-caso-wispro-dialog";
import { TicketDetailDialog } from "./ticket-detail-dialog";
import { TicketFilters } from "./ticket-filters";
import { TicketEditDialog } from "./ticket-edit-dialog";
import { TicketFinalizeDialog } from "./ticket-finalize-dialog";
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

  // Selección múltiple y acciones en lote
  const [selectedIssueIds, setSelectedIssueIds] = useState<Set<string>>(
    new Set(),
  );
  const [isBulkReassignOpen, setIsBulkReassignOpen] = useState(false);
  const [bulkEmployeeId, setBulkEmployeeId] = useState("");
  const [isBulkDeleteOpen, setIsBulkDeleteOpen] = useState(false);
  const [isBulkProcessing, setIsBulkProcessing] = useState(false);

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

  const handleFinalizedCaso = (caso: CrmWisproCaso) => {
    replaceCaso(caso);
    setFinalizeCaso(null);
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

  // Limpieza de IDs seleccionados si dejan de existir en la lista
  useEffect(() => {
    setSelectedIssueIds((prev) => {
      if (prev.size === 0) return prev;
      const validIds = new Set(casos.map((c) => c.wisproIssueId));
      const next = new Set([...prev].filter((id) => validIds.has(id)));
      return next.size === prev.size ? prev : next;
    });
  }, [casos]);

  const allFilteredSelected = useMemo(() => {
    if (!filteredCasos.length) return false;
    return filteredCasos.every((c) => selectedIssueIds.has(c.wisproIssueId));
  }, [filteredCasos, selectedIssueIds]);

  const someFilteredSelected = useMemo(() => {
    if (!filteredCasos.length || allFilteredSelected) return false;
    return filteredCasos.some((c) => selectedIssueIds.has(c.wisproIssueId));
  }, [filteredCasos, selectedIssueIds, allFilteredSelected]);

  const handleToggleSelectAll = () => {
    if (allFilteredSelected) {
      setSelectedIssueIds((prev) => {
        const next = new Set(prev);
        for (const caso of filteredCasos) {
          next.delete(caso.wisproIssueId);
        }
        return next;
      });
    } else {
      setSelectedIssueIds((prev) => {
        const next = new Set(prev);
        for (const caso of filteredCasos) {
          next.add(caso.wisproIssueId);
        }
        return next;
      });
    }
  };

  const handleToggleSelectRow = (issueId: string) => {
    setSelectedIssueIds((prev) => {
      const next = new Set(prev);
      if (next.has(issueId)) {
        next.delete(issueId);
      } else {
        next.add(issueId);
      }
      return next;
    });
  };

  const handleClearSelection = () => {
    setSelectedIssueIds(new Set());
  };

  const handleOpenBulkReassign = async () => {
    setBulkEmployeeId("");
    setIsBulkReassignOpen(true);
    try {
      await loadEmployees();
    } catch {
      // Ignorar si ya cargó
    }
  };

  const handleBulkReassign = async () => {
    if (!bulkEmployeeId || selectedIssueIds.size === 0) return;
    setIsBulkProcessing(true);
    try {
      const ids = Array.from(selectedIssueIds);
      const { succeeded, failed } = await wisproCasoClient.bulkReassignCasos(
        ids,
        bulkEmployeeId,
      );
      if (failed === 0) {
        toast.success(
          succeeded === 1
            ? "1 ticket reasignado correctamente."
            : `${succeeded} tickets reasignados correctamente.`,
        );
      } else {
        toast.warning(
          `${succeeded} reasignados, ${failed} no se pudieron actualizar.`,
        );
      }
      setSelectedIssueIds(new Set());
      setIsBulkReassignOpen(false);
      setBulkEmployeeId("");
      await loadCasos();
    } catch (reassignError) {
      toast.error(
        reassignError instanceof Error
          ? reassignError.message
          : "No se pudieron reasignar los tickets",
      );
    } finally {
      setIsBulkProcessing(false);
    }
  };

  const handleBulkDelete = async () => {
    if (selectedIssueIds.size === 0) return;
    setIsBulkProcessing(true);
    try {
      const ids = Array.from(selectedIssueIds);
      const { succeeded, failed } = await wisproCasoClient.bulkDeleteCasos(ids);
      if (failed === 0) {
        toast.success(
          succeeded === 1
            ? "1 ticket eliminado correctamente."
            : `${succeeded} tickets eliminados correctamente.`,
        );
      } else {
        toast.warning(
          `${succeeded} eliminados, ${failed} no se pudieron eliminar.`,
        );
      }
      setSelectedIssueIds(new Set());
      setIsBulkDeleteOpen(false);
      await loadCasos();
    } catch (deleteError) {
      toast.error(
        deleteError instanceof Error
          ? deleteError.message
          : "No se pudieron eliminar los tickets",
      );
    } finally {
      setIsBulkProcessing(false);
    }
  };

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

      {/* Barra de acciones en lote */}
      {selectedIssueIds.size > 0 ? (
        <div className="flex flex-wrap items-center justify-between gap-3 rounded-2xl border border-crm-accent/30 bg-crm-accent/10 p-3 text-sm animate-in fade-in slide-in-from-top-2 dark:border-crm-accent/20 dark:bg-crm-accent/10">
          <div className="flex items-center gap-2">
            <span className="flex size-6 items-center justify-center rounded-full bg-crm-accent text-xs font-bold text-crm-accent-foreground">
              {selectedIssueIds.size}
            </span>
            <span className={`font-medium ${CRM_SURFACES.textPrimary}`}>
              {selectedIssueIds.size === 1
                ? "1 ticket seleccionado"
                : `${selectedIssueIds.size} tickets seleccionados`}
            </span>
            <Button
              type="button"
              variant="ghost"
              size="sm"
              onClick={handleClearSelection}
              className="h-7 px-2 text-xs text-muted-foreground hover:text-foreground">
              <X className="mr-1 size-3" />
              Deseleccionar
            </Button>
          </div>

          <div className="flex flex-wrap items-center gap-2">
            <Button
              type="button"
              variant="secondary"
              size="sm"
              onClick={() => void handleOpenBulkReassign()}
              className="gap-1.5"
              disabled={isBulkProcessing}>
              <UserRoundPen className="size-3.5" />
              Reasignar ({selectedIssueIds.size})
            </Button>
            <Button
              type="button"
              variant="destructive"
              size="sm"
              onClick={() => setIsBulkDeleteOpen(true)}
              className="gap-1.5"
              disabled={isBulkProcessing}>
              <Trash2 className="size-3.5" />
              Eliminar ({selectedIssueIds.size})
            </Button>
          </div>
        </div>
      ) : null}

      <Card className="overflow-hidden py-0">
        <div className="overflow-x-auto">
          <Table className="min-w-[1220px]">
            <TableHeader>
              <TableRow className={`${CRM_SURFACES.border} hover:bg-transparent`}>
                <TableHead className="w-12 px-3 text-center">
                  <Checkbox
                    checked={
                      allFilteredSelected
                        ? true
                        : someFilteredSelected
                          ? "indeterminate"
                          : false
                    }
                    onCheckedChange={handleToggleSelectAll}
                    aria-label="Seleccionar o deseleccionar todos los tickets visibles"
                  />
                </TableHead>
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
                  const isSelected = selectedIssueIds.has(caso.wisproIssueId);
                  return (
                    <TableRow
                      key={caso.id}
                      data-state={isSelected ? "selected" : undefined}
                      className={`${CRM_SURFACES.border} ${CRM_SURFACES.hover} ${
                        isSelected ? "bg-crm-accent/10 dark:bg-crm-accent/15" : ""
                      }`}>
                      <TableCell className="w-12 px-3 text-center">
                        <Checkbox
                          checked={isSelected}
                          onCheckedChange={() =>
                            handleToggleSelectRow(caso.wisproIssueId)
                          }
                          aria-label={`Seleccionar ticket ${
                            caso.wisproPublicId != null
                              ? `#${caso.wisproPublicId}`
                              : ""
                          }`}
                        />
                      </TableCell>
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
                    colSpan={11}
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

      <TicketFinalizeDialog
        caso={finalizeCaso}
        open={Boolean(finalizeCaso)}
        onOpenChange={(open) => {
          if (!open) setFinalizeCaso(null);
        }}
        onFinalized={handleFinalizedCaso}
      />

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

      {/* Diálogo de reasignación masiva */}
      <Dialog
        open={isBulkReassignOpen}
        onOpenChange={(open) => {
          if (!open && !isBulkProcessing) setIsBulkReassignOpen(false);
        }}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Reasignar tickets seleccionados</DialogTitle>
            <DialogDescription>
              Selecciona el técnico al cual se reasignarán los{" "}
              <strong>{selectedIssueIds.size} tickets</strong> seleccionados.
            </DialogDescription>
          </DialogHeader>
          <div className="mt-4">
            <EmployeePicker
              employees={employees}
              value={bulkEmployeeId}
              onChange={setBulkEmployeeId}
              disabled={isBulkProcessing}
            />
          </div>
          <DialogFooter className="mt-4 gap-2">
            <Button
              type="button"
              variant="secondary"
              onClick={() => setIsBulkReassignOpen(false)}
              disabled={isBulkProcessing}>
              Cancelar
            </Button>
            <Button
              type="button"
              onClick={() => void handleBulkReassign()}
              disabled={isBulkProcessing || !bulkEmployeeId}>
              {isBulkProcessing
                ? "Reasignando..."
                : `Reasignar ${selectedIssueIds.size} ${
                    selectedIssueIds.size === 1 ? "ticket" : "tickets"
                  }`}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Diálogo de confirmación para eliminación masiva */}
      <AlertDialog
        open={isBulkDeleteOpen}
        onOpenChange={(open) => {
          if (!open && !isBulkProcessing) setIsBulkDeleteOpen(false);
        }}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle className="text-red-600 dark:text-red-400">
              ¿Eliminar {selectedIssueIds.size}{" "}
              {selectedIssueIds.size === 1 ? "ticket" : "tickets"}?
            </AlertDialogTitle>
            <AlertDialogDescription>
              Esta acción eliminará de forma permanente los{" "}
              <strong className="text-foreground">
                {selectedIssueIds.size} tickets seleccionados
              </strong>{" "}
              del CRM. Esta acción no se puede deshacer.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel disabled={isBulkProcessing}>
              Cancelar
            </AlertDialogCancel>
            <AlertDialogAction
              onClick={() => void handleBulkDelete()}
              disabled={isBulkProcessing}
              className="bg-red-600 text-white hover:bg-red-700 dark:bg-red-700 dark:hover:bg-red-800">
              {isBulkProcessing
                ? "Eliminando..."
                : `Eliminar ${selectedIssueIds.size} tickets`}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      <CrearCasoWisproDialog
        open={isCreateOpen}
        onOpenChange={setIsCreateOpen}
        onCreated={() => void loadCasos()}
      />
    </section>
  );
};
