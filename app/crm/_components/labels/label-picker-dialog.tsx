"use client";

import { useEffect, useState } from "react";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import type { Label } from "../../_lib/types";
import { CRM_SURFACES } from "../../_lib/crm-theme";
import { LabelChip } from "../shared/label-chip";

interface LabelPickerDialogProps {
  open: boolean;
  labels: Label[];
  selectedLabelIds: number[];
  onOpenChange: (open: boolean) => void;
  onSave: (labelIds: number[]) => Promise<void>;
}

export const LabelPickerDialog = ({
  open,
  labels,
  selectedLabelIds,
  onOpenChange,
  onSave,
}: LabelPickerDialogProps) => {
  const [draft, setDraft] = useState<number[]>(selectedLabelIds);

  useEffect(() => {
    setDraft(selectedLabelIds);
  }, [selectedLabelIds, open]);

  const handleToggleLabel = (labelId: number) => {
    setDraft((current) =>
      current.includes(labelId)
        ? current.filter((id) => id !== labelId)
        : [...current, labelId]
    );
  };

  const handleSubmit = async () => {
    await onSave(draft);
    onOpenChange(false);
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Asignar etiquetas</DialogTitle>
          <DialogDescription className={CRM_SURFACES.textMuted}>
            Haz clic para activar o desactivar etiquetas en esta conversación.
          </DialogDescription>
        </DialogHeader>
        <div className="flex flex-wrap gap-2">
          {labels.map((label) => (
            <LabelChip
              key={label.id}
              label={label}
              selected={draft.includes(label.id)}
              onClick={() => handleToggleLabel(label.id)}
            />
          ))}
        </div>
        <DialogFooter>
          <Button type="button" variant="secondary" onClick={() => onOpenChange(false)}>
            Cancelar
          </Button>
          <Button type="button" onClick={handleSubmit}>
            Guardar
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
};
