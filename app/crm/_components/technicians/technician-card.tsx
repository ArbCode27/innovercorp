"use client";

import { Wrench, Phone, FileText, StickyNote, Trash2 } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { CRM_SURFACES } from "../../_lib/crm-theme";
import type { Agent, Technician } from "../../_lib/types";
import { AvatarInitials } from "../shared/avatar-initials";

interface TechnicianCardProps {
  technician: Technician;
  currentAgent: Agent;
  onEdit: (technician: Technician) => void;
  onToggleStatus: (technician: Technician) => Promise<void>;
  onDelete: (technician: Technician) => Promise<void>;
}

export const TechnicianCard = ({
  technician,
  currentAgent,
  onEdit,
  onToggleStatus,
  onDelete,
}: TechnicianCardProps) => {
  const isAdmin =
    currentAgent.role === "admin" ||
    (currentAgent.role as string) === "administrador";

  const handleEdit = () => {
    onEdit(technician);
  };

  const handleToggleStatus = async () => {
    await onToggleStatus(technician);
  };

  const handleDelete = async () => {
    if (
      window.confirm(
        `¿Estás seguro de eliminar al técnico ${technician.name}?`,
      )
    ) {
      await onDelete(technician);
    }
  };

  const phoneDisplay =
    technician.whatsappPhoneLast10 ||
    technician.whatsappPhone ||
    technician.phoneLast10 ||
    technician.phone ||
    "Sin WhatsApp";

  return (
    <article className={`rounded-2xl p-4 ${CRM_SURFACES.card}`}>
      <div className="flex items-start gap-3">
        <AvatarInitials name={technician.name} />

        <div className="min-w-0 flex-1">
          <div className="flex flex-wrap items-center gap-2">
            <h3
              className={`truncate text-sm font-semibold ${CRM_SURFACES.textPrimary}`}
            >
              {technician.name}
            </h3>
            <span className="inline-flex items-center gap-1 rounded bg-crm-accent/10 px-1.5 py-0.5 text-[10px] font-medium text-crm-accent">
              <Wrench className="size-3" aria-hidden="true" />
              Técnico de Campo
            </span>
          </div>

          <div className="mt-1 flex flex-wrap items-center gap-3 text-xs text-muted-foreground">
            <span className="inline-flex items-center gap-1">
              <Phone className="size-3" aria-hidden="true" />
              WhatsApp: {phoneDisplay}
            </span>

            {technician.document ? (
              <span className="inline-flex items-center gap-1">
                <FileText className="size-3" aria-hidden="true" />
                Cédula: {technician.document}
              </span>
            ) : technician.documentLast4 ? (
              <span className="inline-flex items-center gap-1">
                <FileText className="size-3" aria-hidden="true" />
                Doc: ****{technician.documentLast4}
              </span>
            ) : null}
          </div>

          {technician.notes ? (
            <p className="mt-2 flex items-start gap-1 text-xs text-muted-foreground">
              <StickyNote className="mt-0.5 size-3 shrink-0" aria-hidden="true" />
              <span className="line-clamp-2">{technician.notes}</span>
            </p>
          ) : null}
        </div>

        <Badge variant={technician.active ? "success" : "outline"}>
          {technician.active ? "Activo" : "Inactivo"}
        </Badge>
      </div>

      <p className={`mt-3 text-xs ${CRM_SURFACES.textMuted}`}>
        {technician.active
          ? "Habilitado para asignación de tickets y gestión operativa por WhatsApp."
          : "Desactivado. No aparece en selección de tickets ni recibe reportes."}
      </p>

      {isAdmin ? (
        <div className="mt-4 flex flex-wrap items-center justify-between gap-2 border-t pt-3">
          <div className="flex gap-2">
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
              variant={technician.active ? "outline" : "default"}
              size="sm"
              onClick={handleToggleStatus}
            >
              {technician.active ? "Desactivar" : "Activar"}
            </Button>
          </div>

          <Button
            type="button"
            variant="ghost"
            size="sm"
            onClick={handleDelete}
            className="text-red-600 hover:bg-red-50 hover:text-red-700 dark:hover:bg-red-950/40"
            title="Eliminar técnico"
            aria-label={`Eliminar a ${technician.name}`}
          >
            <Trash2 className="size-4" />
          </Button>
        </div>
      ) : null}
    </article>
  );
};
