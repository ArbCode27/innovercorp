"use client";

import { FormEvent, useState } from "react";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label as UiLabel } from "@/components/ui/label";
import { CRM_COLORS } from "../../_lib/constants";
import type { CreateLabelInput } from "../../_lib/types";

interface LabelFormDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onCreateLabel: (input: CreateLabelInput) => Promise<void>;
}

export const LabelFormDialog = ({
  open,
  onOpenChange,
  onCreateLabel,
}: LabelFormDialogProps) => {
  const [name, setName] = useState("");
  const [colorIndex, setColorIndex] = useState(0);

  const handleSubmit = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    const labelName = name.trim();
    if (!labelName) return;

    const selectedColor = CRM_COLORS[colorIndex];
    await onCreateLabel({
      name: labelName,
      color: selectedColor.color,
      bg: selectedColor.bg,
    });
    setName("");
    setColorIndex(0);
    onOpenChange(false);
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="border-white/10 bg-[#161922] text-slate-100">
        <form onSubmit={handleSubmit}>
          <DialogHeader>
            <DialogTitle>Nueva etiqueta</DialogTitle>
          </DialogHeader>
          <div className="mt-5 space-y-4">
            <div className="space-y-2">
              <UiLabel htmlFor="label-name">Nombre</UiLabel>
              <Input
                id="label-name"
                value={name}
                onChange={(event) => setName(event.target.value)}
                placeholder="ej: pago pendiente, VIP, instalación..."
                className="border-white/10 bg-[#1d2130]"
              />
            </div>
            <div className="space-y-2">
              <UiLabel>Color</UiLabel>
              <div className="flex flex-wrap gap-2">
                {CRM_COLORS.map((item, index) => (
                  <button
                    key={item.color}
                    type="button"
                    onClick={() => setColorIndex(index)}
                    className={`size-6 rounded-full border-2 transition ${
                      colorIndex === index ? "scale-110 border-white" : "border-transparent"
                    }`}
                    style={{ backgroundColor: item.color }}
                    aria-label={`Color ${index + 1}`}
                  />
                ))}
              </div>
            </div>
          </div>
          <DialogFooter className="mt-5">
            <Button type="button" variant="outline" onClick={() => onOpenChange(false)}>
              Cancelar
            </Button>
            <Button type="submit" className="bg-blue-500">
              Crear etiqueta
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
};
