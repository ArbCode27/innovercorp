"use client";

import { Wrench } from "lucide-react";
import type { Agent, Technician } from "../../_lib/types";
import { EmptyState } from "../shared/empty-state";
import { TechnicianCard } from "./technician-card";

interface TechniciansListProps {
  technicians: Technician[];
  currentAgent: Agent;
  onEdit: (technician: Technician) => void;
  onToggleStatus: (technician: Technician) => Promise<void>;
  onDelete: (technician: Technician) => Promise<void>;
}

export const TechniciansList = ({
  technicians,
  currentAgent,
  onEdit,
  onToggleStatus,
  onDelete,
}: TechniciansListProps) => {
  if (!technicians.length) {
    return (
      <EmptyState
        icon={Wrench}
        title="No hay técnicos registrados"
        description="Registra un técnico para asignarle tickets y permitirle interactuar con el bot de WhatsApp."
      />
    );
  }

  return (
    <div className="grid gap-3 xl:grid-cols-2">
      {technicians.map((technician) => (
        <TechnicianCard
          key={technician.id}
          technician={technician}
          currentAgent={currentAgent}
          onEdit={onEdit}
          onToggleStatus={onToggleStatus}
          onDelete={onDelete}
        />
      ))}
    </div>
  );
};
