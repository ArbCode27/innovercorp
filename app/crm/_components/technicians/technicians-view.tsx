"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import { Plus, RefreshCw, Search, Users, Wrench } from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { CRM_SURFACES } from "../../_lib/crm-theme";
import { crmService } from "../../_lib/crm-service";
import type { Agent, Technician, UpsertTechnicianInput } from "../../_lib/types";
import { LoadingState } from "../shared/loading-state";
import { TechnicianFormDialog } from "./technician-form-dialog";
import { TechniciansList } from "./technicians-list";

interface TechniciansViewProps {
  currentAgent: Agent;
}

export const TechniciansView = ({ currentAgent }: TechniciansViewProps) => {
  const [technicians, setTechnicians] = useState<Technician[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [isRefreshing, setIsRefreshing] = useState(false);
  const [isDialogOpen, setIsDialogOpen] = useState(false);
  const [editingTechnician, setEditingTechnician] =
    useState<Technician | null>(null);

  const [searchQuery, setSearchQuery] = useState("");
  const [statusFilter, setStatusFilter] = useState<"all" | "active" | "inactive">(
    "all",
  );

  const isAdmin =
    currentAgent.role === "admin" ||
    (currentAgent.role as string) === "administrador";

  const fetchTechnicians = useCallback(
    async (isBackground = false) => {
      if (!isBackground) setIsLoading(true);
      else setIsRefreshing(true);

      try {
        const list = await crmService.listTechnicians(currentAgent.id);
        setTechnicians(list);
      } catch (error) {
        toast.error(
          error instanceof Error
            ? error.message
            : "No se pudieron cargar los técnicos",
        );
      } finally {
        setIsLoading(false);
        setIsRefreshing(false);
      }
    },
    [currentAgent.id],
  );

  useEffect(() => {
    fetchTechnicians();
  }, [fetchTechnicians]);

  const handleNewTechnician = () => {
    setEditingTechnician(null);
    setIsDialogOpen(true);
  };

  const handleEditTechnician = (technician: Technician) => {
    setEditingTechnician(technician);
    setIsDialogOpen(true);
  };

  const handleSaveTechnician = async (input: UpsertTechnicianInput) => {
    await crmService.upsertTechnician(input, currentAgent.id);
    await fetchTechnicians(true);
  };

  const handleToggleStatus = async (technician: Technician) => {
    try {
      await crmService.toggleTechnicianStatus(technician, currentAgent.id);
      toast.success(
        technician.active ? "Técnico desactivado" : "Técnico activado",
      );
      await fetchTechnicians(true);
    } catch (error) {
      toast.error(
        error instanceof Error
          ? error.message
          : "No se pudo actualizar el estado",
      );
    }
  };

  const handleDeleteTechnician = async (technician: Technician) => {
    try {
      await crmService.deleteTechnician(technician.id, currentAgent.id);
      toast.success("Técnico eliminado");
      await fetchTechnicians(true);
    } catch (error) {
      toast.error(
        error instanceof Error
          ? error.message
          : "No se pudo eliminar el técnico",
      );
    }
  };

  const handleRefresh = () => {
    fetchTechnicians(true);
  };

  const filteredTechnicians = useMemo(() => {
    const query = searchQuery.trim().toLowerCase();
    return technicians.filter((tech) => {
      if (statusFilter === "active" && !tech.active) return false;
      if (statusFilter === "inactive" && tech.active) return false;

      if (!query) return true;
      const matchName = tech.name.toLowerCase().includes(query);
      const matchPhone =
        tech.whatsappPhoneLast10?.includes(query) ||
        tech.phoneLast10?.includes(query) ||
        tech.whatsappPhone?.includes(query) ||
        tech.phone?.includes(query);
      const matchDoc =
        tech.document?.toLowerCase().includes(query) ||
        tech.documentLast4?.includes(query);
      const matchNotes = tech.notes?.toLowerCase().includes(query);

      return Boolean(matchName || matchPhone || matchDoc || matchNotes);
    });
  }, [technicians, searchQuery, statusFilter]);

  const activeCount = useMemo(
    () => technicians.filter((t) => t.active).length,
    [technicians],
  );

  return (
    <div className="crm-scrollbar min-h-0 flex-1 overflow-y-auto p-4 md:p-6">
      {/* Header */}
      <div className="mb-6 flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <div className="flex items-center gap-2">
            <h2
              className={`text-xl font-semibold md:text-2xl ${CRM_SURFACES.textPrimary}`}
            >
              Técnicos
            </h2>
            <Badge variant="outline" className="text-xs">
              {activeCount} activos / {technicians.length} total
            </Badge>
          </div>
          <p className={`text-sm ${CRM_SURFACES.textMuted}`}>
            Gestión de técnicos de campo para asignación de tickets y reportes por WhatsApp
          </p>
        </div>

        <div className="flex items-center gap-2">
          <Button
            type="button"
            variant="outline"
            size="sm"
            onClick={handleRefresh}
            disabled={isRefreshing || isLoading}
            aria-label="Refrescar lista de técnicos"
          >
            <RefreshCw
              className={`size-4 ${isRefreshing ? "animate-spin" : ""}`}
              aria-hidden="true"
            />
          </Button>

          {isAdmin ? (
            <Button
              type="button"
              onClick={handleNewTechnician}
              className="gap-2"
              aria-label="Registrar nuevo técnico"
            >
              <Plus className="size-4" aria-hidden="true" />
              Nuevo técnico
            </Button>
          ) : null}
        </div>
      </div>

      {/* Filter and Search Bar */}
      <div className="mb-6 flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <div className="relative flex-1 max-w-md">
          <Search className="absolute left-3 top-1/2 size-4 -translate-y-1/2 text-muted-foreground" />
          <Input
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            placeholder="Buscar técnico por nombre, teléfono, cédula..."
            className="pl-9"
          />
        </div>

        <div className="flex gap-1 rounded-lg border p-1 bg-muted/40">
          <Button
            type="button"
            size="sm"
            variant={statusFilter === "all" ? "secondary" : "ghost"}
            className="h-7 text-xs"
            onClick={() => setStatusFilter("all")}
          >
            Todos ({technicians.length})
          </Button>
          <Button
            type="button"
            size="sm"
            variant={statusFilter === "active" ? "secondary" : "ghost"}
            className="h-7 text-xs"
            onClick={() => setStatusFilter("active")}
          >
            Activos ({activeCount})
          </Button>
          <Button
            type="button"
            size="sm"
            variant={statusFilter === "inactive" ? "secondary" : "ghost"}
            className="h-7 text-xs"
            onClick={() => setStatusFilter("inactive")}
          >
            Inactivos ({technicians.length - activeCount})
          </Button>
        </div>
      </div>

      {/* Body */}
      {isLoading ? (
        <div className="py-12">
          <LoadingState label="Cargando técnicos..." />
        </div>
      ) : (
        <TechniciansList
          technicians={filteredTechnicians}
          currentAgent={currentAgent}
          onEdit={handleEditTechnician}
          onToggleStatus={handleToggleStatus}
          onDelete={handleDeleteTechnician}
        />
      )}

      {/* Dialog Form */}
      <TechnicianFormDialog
        open={isDialogOpen}
        editingTechnician={editingTechnician}
        onOpenChange={setIsDialogOpen}
        onSaveTechnician={handleSaveTechnician}
      />
    </div>
  );
};
