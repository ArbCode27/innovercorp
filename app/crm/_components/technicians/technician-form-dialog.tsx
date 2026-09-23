"use client";

import { FormEvent, useEffect, useState } from "react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import { Textarea } from "@/components/ui/textarea";
import { digitsOnly } from "@/lib/phone-match";
import type { Technician, UpsertTechnicianInput } from "../../_lib/types";

interface TechnicianFormDialogProps {
  open: boolean;
  editingTechnician: Technician | null;
  onOpenChange: (open: boolean) => void;
  onSaveTechnician: (input: UpsertTechnicianInput) => Promise<void>;
}

export const TechnicianFormDialog = ({
  open,
  editingTechnician,
  onOpenChange,
  onSaveTechnician,
}: TechnicianFormDialogProps) => {
  const [name, setName] = useState("");
  const [whatsappPhone, setWhatsappPhone] = useState("");
  const [document, setDocument] = useState("");
  const [notes, setNotes] = useState("");
  const [active, setActive] = useState(true);
  const [isSubmitting, setIsSubmitting] = useState(false);

  useEffect(() => {
    if (!open) return;

    if (editingTechnician) {
      setName(editingTechnician.name);
      setWhatsappPhone(
        editingTechnician.whatsappPhoneLast10 ||
          editingTechnician.whatsappPhone ||
          editingTechnician.phoneLast10 ||
          editingTechnician.phone ||
          "",
      );
      setDocument(editingTechnician.document || "");
      setNotes(editingTechnician.notes || "");
      setActive(editingTechnician.active);
    } else {
      setName("");
      setWhatsappPhone("");
      setDocument("");
      setNotes("");
      setActive(true);
    }
  }, [editingTechnician, open]);

  const handleSubmit = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    const normalizedName = name.trim();
    const normalizedPhone = whatsappPhone.trim();
    const digits = digitsOnly(normalizedPhone);

    if (!normalizedName) {
      toast.error("El nombre del técnico es requerido");
      return;
    }

    if (digits.length < 10) {
      toast.error("El WhatsApp debe tener al menos 10 dígitos (ej: 04141234567)");
      return;
    }

    setIsSubmitting(true);
    try {
      await onSaveTechnician({
        id: editingTechnician?.id,
        name: normalizedName,
        whatsappPhone: digits.slice(-10),
        document: document.trim() || null,
        notes: notes.trim() || null,
        active,
      });
      toast.success(
        editingTechnician ? "Técnico actualizado" : "Técnico registrado",
      );
      onOpenChange(false);
    } catch (error) {
      toast.error(
        error instanceof Error ? error.message : "Error al guardar técnico",
      );
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-md sm:max-w-lg">
        <form onSubmit={handleSubmit}>
          <DialogHeader>
            <DialogTitle>
              {editingTechnician ? "Editar técnico" : "Nuevo técnico"}
            </DialogTitle>
            <DialogDescription>
              Registra los datos del técnico para asignarle tickets y permitirle
              interactuar con el bot de WhatsApp.
            </DialogDescription>
          </DialogHeader>

          <div className="mt-4 space-y-4">
            <div className="space-y-1.5">
              <Label htmlFor="technician-name">Nombre completo *</Label>
              <Input
                id="technician-name"
                value={name}
                onChange={(event) => setName(event.target.value)}
                placeholder="Ej. Joel Cárdenas"
                required
                autoFocus
              />
            </div>

            <div className="grid gap-4 sm:grid-cols-2">
              <div className="space-y-1.5">
                <Label htmlFor="technician-phone">WhatsApp del técnico *</Label>
                <Input
                  id="technician-phone"
                  value={whatsappPhone}
                  onChange={(event) => setWhatsappPhone(event.target.value)}
                  placeholder="04141234567"
                  required
                />
                <p className="text-[11px] text-muted-foreground">
                  Al menos 10 dígitos. Usado para autenticarlo en WhatsApp.
                </p>
              </div>

              <div className="space-y-1.5">
                <Label htmlFor="technician-document">Cédula / Documento</Label>
                <Input
                  id="technician-document"
                  value={document}
                  onChange={(event) => setDocument(event.target.value)}
                  placeholder="V-12345678"
                />
                <p className="text-[11px] text-muted-foreground">
                  Opcional. Usado para verificación de identidad.
                </p>
              </div>
            </div>

            <div className="space-y-1.5">
              <Label htmlFor="technician-notes">Notas / Zona de trabajo</Label>
              <Textarea
                id="technician-notes"
                value={notes}
                onChange={(event) => setNotes(event.target.value)}
                placeholder="Ej. Zona norte, instalaciones de fibra, vehículo moto..."
                rows={2}
              />
            </div>

            <div className="flex items-center justify-between rounded-lg border p-3">
              <div className="space-y-0.5">
                <Label htmlFor="technician-active" className="cursor-pointer">
                  Técnico activo
                </Label>
                <p className="text-xs text-muted-foreground">
                  Los técnicos inactivos no reciben tickets ni pueden consultar el bot.
                </p>
              </div>
              <Switch
                id="technician-active"
                checked={active}
                onCheckedChange={setActive}
              />
            </div>
          </div>

          <DialogFooter className="mt-6 gap-2">
            <Button
              type="button"
              variant="secondary"
              onClick={() => onOpenChange(false)}
              disabled={isSubmitting}
            >
              Cancelar
            </Button>
            <Button type="submit" disabled={isSubmitting}>
              {isSubmitting
                ? "Guardando..."
                : editingTechnician
                  ? "Actualizar"
                  : "Registrar técnico"}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
};
