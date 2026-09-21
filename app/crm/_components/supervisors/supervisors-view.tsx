"use client";

import { useCallback, useEffect, useState } from "react";
import { Plus, RefreshCw } from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { CRM_SURFACES } from "../../_lib/crm-theme";
import { crmService } from "../../_lib/crm-service";
import type { Agent, Supervisor, UpsertSupervisorInput } from "../../_lib/types";
import { LoadingState } from "../shared/loading-state";
import { SupervisorFormDialog } from "./supervisor-form-dialog";
import { SupervisorsList } from "./supervisors-list";

interface SupervisorsViewProps {
  currentAgent: Agent;
}

export const SupervisorsView = ({ currentAgent }: SupervisorsViewProps) => {
  const [supervisors, setSupervisors] = useState<Supervisor[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [isRefreshing, setIsRefreshing] = useState(false);
  const [isDialogOpen, setIsDialogOpen] = useState(false);
  const [editingSupervisor, setEditingSupervisor] = useState<Supervisor | null>(
    null,
  );

  const isAdmin =
    currentAgent.role === "admin" ||
    (currentAgent.role as string) === "administrador";

  const fetchSupervisors = useCallback(
    async (isBackground = false) => {
      if (!isBackground) setIsLoading(true);
      else setIsRefreshing(true);

      try {
        const list = await crmService.listSupervisors(currentAgent.id);
        setSupervisors(list);
      } catch (error) {
        toast.error(
          error instanceof Error
            ? error.message
            : "No se pudieron cargar los gerentes",
        );
      } finally {
        setIsLoading(false);
        setIsRefreshing(false);
      }
    },
    [currentAgent.id],
  );

  useEffect(() => {
    fetchSupervisors();
  }, [fetchSupervisors]);

  const handleNewSupervisor = () => {
    setEditingSupervisor(null);
    setIsDialogOpen(true);
  };

  const handleEditSupervisor = (supervisor: Supervisor) => {
    setEditingSupervisor(supervisor);
    setIsDialogOpen(true);
  };

  const handleSaveSupervisor = async (input: UpsertSupervisorInput) => {
    await crmService.upsertSupervisor(input, currentAgent.id);
    await fetchSupervisors(true);
  };

  const handleToggleStatus = async (supervisor: Supervisor) => {
    try {
      await crmService.toggleSupervisorStatus(supervisor, currentAgent.id);
      toast.success(
        supervisor.active ? "Gerente desactivado" : "Gerente activado",
      );
      await fetchSupervisors(true);
    } catch (error) {
      toast.error(
        error instanceof Error
          ? error.message
          : "No se pudo actualizar el estado",
      );
    }
  };

  const handleRefresh = () => {
    fetchSupervisors(true);
  };

  return (
    <div className="crm-scrollbar min-h-0 flex-1 overflow-y-auto p-4 md:p-6">
      <div className="mb-6 flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <h2
            className={`text-xl font-semibold md:text-2xl ${CRM_SURFACES.textPrimary}`}
          >
            Gerentes
          </h2>
          <p className={`text-sm ${CRM_SURFACES.textMuted}`}>
            Supervisores autorizados para monitorear tickets y colas de técnicos
            en WhatsApp
          </p>
        </div>

        <div className="flex items-center gap-2">
          <Button
            type="button"
            variant="outline"
            size="sm"
            onClick={handleRefresh}
            disabled={isRefreshing || isLoading}
            aria-label="Refrescar lista de gerentes"
          >
            <RefreshCw
              className={`size-4 ${isRefreshing ? "animate-spin" : ""}`}
              aria-hidden="true"
            />
          </Button>

          {isAdmin ? (
            <Button
              type="button"
              onClick={handleNewSupervisor}
              className="w-full sm:w-auto"
            >
              <Plus className="mr-2 size-4" aria-hidden="true" />
              Nuevo gerente
            </Button>
          ) : null}
        </div>
      </div>

      {isLoading ? (
        <LoadingState label="Cargando gerentes..." />
      ) : (
        <SupervisorsList
          supervisors={supervisors}
          currentAgent={currentAgent}
          onEdit={handleEditSupervisor}
          onToggleStatus={handleToggleStatus}
        />
      )}

      <SupervisorFormDialog
        open={isDialogOpen}
        editingSupervisor={editingSupervisor}
        onOpenChange={setIsDialogOpen}
        onSaveSupervisor={handleSaveSupervisor}
      />
    </div>
  );
};
