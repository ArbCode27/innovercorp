"use client";

import { useState } from "react";
import { Loader2, UserMinus, UserPlus, Users } from "lucide-react";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { CRM_SURFACES } from "../../_lib/crm-theme";
import type { Agent } from "../../_lib/types";
import { cn } from "@/lib/utils";

interface BulkReassignDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  count: number;
  currentAgentId: number;
  agents: Agent[];
  isSubmitting: boolean;
  onConfirm: (targetAgentId: number | null) => Promise<void>;
}

export const BulkReassignDialog = ({
  open,
  onOpenChange,
  count,
  currentAgentId,
  agents,
  isSubmitting,
  onConfirm,
}: BulkReassignDialogProps) => {
  const [mode, setMode] = useState<"assign" | "unassign">("assign");
  const [selectedAgentId, setSelectedAgentId] = useState<string>("");

  const otherAgents = agents.filter(
    (agent) => Number(agent.id) !== Number(currentAgentId) && agent.status !== "inactive",
  );

  const handleSubmit = async () => {
    if (mode === "assign" && !selectedAgentId) return;
    const targetId = mode === "unassign" ? null : Number(selectedAgentId);
    await onConfirm(targetId);
    setSelectedAgentId("");
    onOpenChange(false);
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-md">
        <DialogHeader>
          <DialogTitle className={`flex items-center gap-2 ${CRM_SURFACES.textPrimary}`}>
            <Users className="size-5 text-crm-accent" aria-hidden="true" />
            Reasignar {count} {count === 1 ? "conversación" : "conversaciones"}
          </DialogTitle>
          <DialogDescription className={CRM_SURFACES.textMuted}>
            Transfiere las conversaciones seleccionadas a otro asesor o libéralas a la cola sin asignar.
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-4 py-2">
          <div className="grid grid-cols-2 gap-2">
            <button
              type="button"
              onClick={() => setMode("assign")}
              className={cn(
                "flex flex-col items-center justify-center gap-1.5 rounded-xl border p-3 text-xs font-medium transition",
                mode === "assign"
                  ? "border-primary bg-primary/10 text-primary font-semibold"
                  : `${CRM_SURFACES.border} ${CRM_SURFACES.textMuted} hover:bg-muted/50`,
              )}>
              <UserPlus className="size-4" aria-hidden="true" />
              <span>Transferir a asesor</span>
            </button>

            <button
              type="button"
              onClick={() => setMode("unassign")}
              className={cn(
                "flex flex-col items-center justify-center gap-1.5 rounded-xl border p-3 text-xs font-medium transition",
                mode === "unassign"
                  ? "border-amber-600 bg-amber-500/10 text-amber-600 dark:text-amber-400 font-semibold"
                  : `${CRM_SURFACES.border} ${CRM_SURFACES.textMuted} hover:bg-muted/50`,
              )}>
              <UserMinus className="size-4" aria-hidden="true" />
              <span>Liberar (Sin asignar)</span>
            </button>
          </div>

          {mode === "assign" ? (
            <div className="space-y-2">
              <label className={`text-xs font-medium ${CRM_SURFACES.textPrimary}`}>
                Selecciona el asesor destino:
              </label>
              {otherAgents.length === 0 ? (
                <p className="text-xs text-muted-foreground">
                  No hay otros asesores activos disponibles.
                </p>
              ) : (
                <Select value={selectedAgentId} onValueChange={setSelectedAgentId}>
                  <SelectTrigger className="w-full">
                    <SelectValue placeholder="Elige un asesor..." />
                  </SelectTrigger>
                  <SelectContent>
                    {otherAgents.map((agent) => (
                      <SelectItem key={agent.id} value={String(agent.id)}>
                        {agent.name} {agent.status === "online" ? "🟢" : "⚪"} ({agent.role})
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              )}
            </div>
          ) : (
            <div className="rounded-xl border border-amber-500/20 bg-amber-500/10 p-3 text-xs text-amber-700 dark:text-amber-300">
              Las conversaciones volverán a la bandeja de <strong>Sin asignar</strong> para que
              cualquier asesor disponible o supervisor pueda tomarlas.
            </div>
          )}
        </div>

        <DialogFooter className="gap-2 sm:gap-0">
          <Button
            type="button"
            variant="ghost"
            onClick={() => onOpenChange(false)}
            disabled={isSubmitting}>
            Cancelar
          </Button>
          <Button
            type="button"
            onClick={() => void handleSubmit()}
            disabled={
              isSubmitting ||
              (mode === "assign" && (!selectedAgentId || otherAgents.length === 0))
            }>
            {isSubmitting ? (
              <>
                <Loader2 className="mr-2 size-4 animate-spin" />
                Procesando...
              </>
            ) : mode === "assign" ? (
              `Reasignar (${count})`
            ) : (
              `Liberar (${count})`
            )}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
};
