"use client";

import { ShieldCheck, Phone, Link2 } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { CRM_SURFACES } from "../../_lib/crm-theme";
import type { Agent, Supervisor } from "../../_lib/types";
import { AvatarInitials } from "../shared/avatar-initials";

interface SupervisorCardProps {
  supervisor: Supervisor;
  currentAgent: Agent;
  onEdit: (supervisor: Supervisor) => void;
  onToggleStatus: (supervisor: Supervisor) => Promise<void>;
}

export const SupervisorCard = ({
  supervisor,
  currentAgent,
  onEdit,
  onToggleStatus,
}: SupervisorCardProps) => {
  const isAdmin =
    currentAgent.role === "admin" ||
    (currentAgent.role as string) === "administrador";

  const handleEdit = () => {
    onEdit(supervisor);
  };

  const handleToggleStatus = async () => {
    await onToggleStatus(supervisor);
  };

  return (
    <article className={`rounded-2xl p-4 ${CRM_SURFACES.card}`}>
      <div className="flex items-start gap-3">
        <AvatarInitials name={supervisor.name} />

        <div className="min-w-0 flex-1">
          <div className="flex flex-wrap items-center gap-2">
            <h3
              className={`truncate text-sm font-semibold ${CRM_SURFACES.textPrimary}`}
            >
              {supervisor.name}
            </h3>
            <span className="inline-flex items-center gap-1 rounded bg-crm-accent/10 px-1.5 py-0.5 text-[10px] font-medium text-crm-accent">
              <ShieldCheck className="size-3" aria-hidden="true" />
              Supervisor
            </span>
          </div>

          <div className="mt-1 flex flex-wrap items-center gap-3 text-xs text-muted-foreground">
            <span className="inline-flex items-center gap-1">
              <Phone className="size-3" aria-hidden="true" />
              WhatsApp: {supervisor.phoneLast10}
            </span>

            {supervisor.wisproEmployeeId ? (
              <span className="inline-flex items-center gap-1 text-[11px] text-crm-accent-muted-foreground">
                <Link2 className="size-3" aria-hidden="true" />
                Wispro vinculado
              </span>
            ) : null}
          </div>
        </div>

        <Badge variant={supervisor.active ? "success" : "outline"}>
          {supervisor.active ? "Activo" : "Inactivo"}
        </Badge>
      </div>

      <p className={`mt-3 text-xs ${CRM_SURFACES.textMuted}`}>
        {supervisor.active
          ? "Autorizado para consultar colas y tickets de técnicos vía WhatsApp."
          : "Desactivado. El bot no le permitirá consultar colas de técnicos."}
      </p>

      {isAdmin ? (
        <div className="mt-4 flex flex-wrap gap-2">
          <Button
            type="button"
            variant="secondary"
            size="sm"
            onClick={handleEdit}
          >
            Editar
          </Button>
          <Button
            type="button"
            variant={supervisor.active ? "destructive" : "outline"}
            size="sm"
            onClick={handleToggleStatus}
          >
            {supervisor.active ? "Desactivar" : "Activar"}
          </Button>
        </div>
      ) : null}
    </article>
  );
};
