"use client";

import { ShieldAlert } from "lucide-react";
import type { Agent, Supervisor } from "../../_lib/types";
import { EmptyState } from "../shared/empty-state";
import { SupervisorCard } from "./supervisor-card";

interface SupervisorsListProps {
  supervisors: Supervisor[];
  currentAgent: Agent;
  onEdit: (supervisor: Supervisor) => void;
  onToggleStatus: (supervisor: Supervisor) => Promise<void>;
}

export const SupervisorsList = ({
  supervisors,
  currentAgent,
  onEdit,
  onToggleStatus,
}: SupervisorsListProps) => {
  if (!supervisors.length) {
    return (
      <EmptyState
        icon={ShieldAlert}
        title="No hay gerentes registrados"
        description="Agrega un gerente para autorizarlo a supervisar los tickets de soporte desde WhatsApp."
      />
    );
  }

  return (
    <div className="grid gap-3 xl:grid-cols-2">
      {supervisors.map((supervisor) => (
        <SupervisorCard
          key={supervisor.id}
          supervisor={supervisor}
          currentAgent={currentAgent}
          onEdit={onEdit}
          onToggleStatus={onToggleStatus}
        />
      ))}
    </div>
  );
};
