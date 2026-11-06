"use client";

import { useState } from "react";
import { Loader2, Tag, Plus, Minus, RefreshCw } from "lucide-react";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
import { CRM_SURFACES } from "../../_lib/crm-theme";
import type { Label } from "../../_lib/types";
import { cn } from "@/lib/utils";

type BulkLabelAction = "add" | "remove" | "replace";

interface BulkLabelsDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  count: number;
  labels: Label[];
  isSubmitting: boolean;
  onConfirm: (
    action: BulkLabelAction,
    targetLabelIds: number[],
  ) => Promise<void>;
}

export const BulkLabelsDialog = ({
  open,
  onOpenChange,
  count,
  labels,
  isSubmitting,
  onConfirm,
}: BulkLabelsDialogProps) => {
  const [action, setAction] = useState<BulkLabelAction>("add");
  const [selectedLabelIds, setSelectedLabelIds] = useState<Set<number>>(new Set());

  const handleToggleLabel = (labelId: number) => {
    setSelectedLabelIds((prev) => {
      const next = new Set(prev);
      if (next.has(labelId)) {
        next.delete(labelId);
      } else {
        next.add(labelId);
      }
      return next;
    });
  };

  const handleSelectAll = () => {
    if (selectedLabelIds.size === labels.length) {
      setSelectedLabelIds(new Set());
    } else {
      setSelectedLabelIds(new Set(labels.map((l) => l.id)));
    }
  };

  const handleSubmit = async () => {
    if (selectedLabelIds.size === 0) return;
    await onConfirm(action, Array.from(selectedLabelIds));
    setSelectedLabelIds(new Set());
    onOpenChange(false);
  };

  const actionDescriptions: Record<BulkLabelAction, string> = {
    add: "Se añadirán estas etiquetas conservando las que cada conversación ya tenga.",
    remove: "Se removerán estas etiquetas de las conversaciones seleccionadas si las tienen.",
    replace: "Todas las conversaciones seleccionadas tendrán exactamente estas etiquetas.",
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-md">
        <DialogHeader>
          <DialogTitle className={`flex items-center gap-2 ${CRM_SURFACES.textPrimary}`}>
            <Tag className="size-5 text-crm-accent" aria-hidden="true" />
            Etiquetar {count} {count === 1 ? "conversación" : "conversaciones"}
          </DialogTitle>
          <DialogDescription className={CRM_SURFACES.textMuted}>
            Elige la acción y las etiquetas que deseas aplicar a las conversaciones seleccionadas.
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-4 py-2">
          {/* Selector de modo de acción */}
          <div className="space-y-1.5">
            <label className={`text-xs font-semibold ${CRM_SURFACES.textPrimary}`}>
              Modo de etiquetado
            </label>
            <div className="grid grid-cols-3 gap-1.5">
              <button
                type="button"
                onClick={() => setAction("add")}
                className={cn(
                  "flex flex-col items-center justify-center gap-1 rounded-xl border p-2 text-xs font-medium transition",
                  action === "add"
                    ? "border-primary bg-primary/10 text-primary font-semibold"
                    : `${CRM_SURFACES.border} ${CRM_SURFACES.textMuted} hover:bg-muted/50`,
                )}>
                <Plus className="size-4" aria-hidden="true" />
                <span>Agregar</span>
              </button>

              <button
                type="button"
                onClick={() => setAction("remove")}
                className={cn(
                  "flex flex-col items-center justify-center gap-1 rounded-xl border p-2 text-xs font-medium transition",
                  action === "remove"
                    ? "border-destructive bg-destructive/10 text-destructive font-semibold"
                    : `${CRM_SURFACES.border} ${CRM_SURFACES.textMuted} hover:bg-muted/50`,
                )}>
                <Minus className="size-4" aria-hidden="true" />
                <span>Quitar</span>
              </button>

              <button
                type="button"
                onClick={() => setAction("replace")}
                className={cn(
                  "flex flex-col items-center justify-center gap-1 rounded-xl border p-2 text-xs font-medium transition",
                  action === "replace"
                    ? "border-amber-600 bg-amber-500/10 text-amber-600 dark:text-amber-400 font-semibold"
                    : `${CRM_SURFACES.border} ${CRM_SURFACES.textMuted} hover:bg-muted/50`,
                )}>
                <RefreshCw className="size-4" aria-hidden="true" />
                <span>Reemplazar</span>
              </button>
            </div>
            <p className="text-[11px] text-muted-foreground">{actionDescriptions[action]}</p>
          </div>

          {/* Lista de etiquetas */}
          <div className="space-y-2">
            <div className="flex items-center justify-between">
              <label className={`text-xs font-semibold ${CRM_SURFACES.textPrimary}`}>
                Etiquetas disponibles ({labels.length})
              </label>
              {labels.length > 0 ? (
                <button
                  type="button"
                  onClick={handleSelectAll}
                  className="text-xs text-primary hover:underline">
                  {selectedLabelIds.size === labels.length ? "Deseleccionar todas" : "Seleccionar todas"}
                </button>
              ) : null}
            </div>

            {labels.length === 0 ? (
              <p className="py-4 text-center text-xs text-muted-foreground">
                No hay etiquetas creadas en el sistema.
              </p>
            ) : (
              <div className="crm-scrollbar max-h-56 space-y-1.5 overflow-y-auto rounded-xl border p-2">
                {labels.map((label) => {
                  const isChecked = selectedLabelIds.has(label.id);
                  return (
                    <label
                      key={label.id}
                      className={cn(
                        "flex cursor-pointer items-center justify-between rounded-lg px-2.5 py-1.5 text-xs transition",
                        isChecked
                          ? "bg-accent text-accent-foreground font-medium"
                          : "hover:bg-muted/50 text-foreground",
                      )}>
                      <div className="flex items-center gap-2">
                        <Checkbox
                          checked={isChecked}
                          onCheckedChange={() => handleToggleLabel(label.id)}
                          aria-label={`Seleccionar etiqueta ${label.name}`}
                        />
                        <span
                          className="size-2 rounded-full"
                          style={{ backgroundColor: label.color }}
                          aria-hidden="true"
                        />
                        <span>{label.name}</span>
                      </div>
                      <span
                        className="rounded px-1.5 py-0.5 text-[10px] font-medium"
                        style={{
                          backgroundColor: label.bg,
                          color: label.color,
                        }}>
                        {label.name}
                      </span>
                    </label>
                  );
                })}
              </div>
            )}
          </div>
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
            disabled={isSubmitting || selectedLabelIds.size === 0}>
            {isSubmitting ? (
              <>
                <Loader2 className="mr-2 size-4 animate-spin" />
                Aplicando...
              </>
            ) : (
              `Aplicar (${selectedLabelIds.size})`
            )}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
};
