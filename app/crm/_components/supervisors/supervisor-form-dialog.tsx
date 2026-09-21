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
import { EmployeePicker } from "../wispro/employee-picker";
import { wisproCasoClient } from "../../_lib/wispro-caso-client";
import type { Supervisor, UpsertSupervisorInput } from "../../_lib/types";
import type { WisproEmployee } from "@/lib/wispro-types";

interface SupervisorFormDialogProps {
  open: boolean;
  editingSupervisor: Supervisor | null;
  onOpenChange: (open: boolean) => void;
  onSaveSupervisor: (input: UpsertSupervisorInput) => Promise<void>;
}

export const SupervisorFormDialog = ({
  open,
  editingSupervisor,
  onOpenChange,
  onSaveSupervisor,
}: SupervisorFormDialogProps) => {
  const [name, setName] = useState("");
  const [phone, setPhone] = useState("");
  const [wisproEmployeeId, setWisproEmployeeId] = useState("");
  const [active, setActive] = useState(true);
  const [employees, setEmployees] = useState<WisproEmployee[]>([]);
  const [isLoadingEmployees, setIsLoadingEmployees] = useState(false);
  const [isSubmitting, setIsSubmitting] = useState(false);

  // Load Wispro catalog employees when dialog opens
  useEffect(() => {
    if (!open) return;

    let isMounted = true;
    const fetchEmployees = async () => {
      setIsLoadingEmployees(true);
      try {
        const catalog = await wisproCasoClient.loadCatalog({
          allEmployees: true,
        });
        if (isMounted) {
          setEmployees(catalog.employees || []);
        }
      } catch (error) {
        console.warn("[SUPERVISOR_FORM] load_employees_failed", error);
      } finally {
        if (isMounted) {
          setIsLoadingEmployees(false);
        }
      }
    };

    fetchEmployees();

    return () => {
      isMounted = false;
    };
  }, [open]);

  // Re-populate state when editingSupervisor or open state changes
  useEffect(() => {
    if (!open) return;

    if (editingSupervisor) {
      setName(editingSupervisor.name);
      setPhone(editingSupervisor.phoneLast10);
      setWisproEmployeeId(editingSupervisor.wisproEmployeeId || "");
      setActive(editingSupervisor.active);
    } else {
      setName("");
      setPhone("");
      setWisproEmployeeId("");
      setActive(true);
    }
  }, [editingSupervisor, open]);

  const handleEmployeeChange = (employeeId: string) => {
    setWisproEmployeeId(employeeId);
    if (!employeeId) return;

    const matched = employees.find((emp) => emp.id === employeeId);
    if (!matched) return;

    // Auto-fill name if empty or previous employee name
    if (!name.trim()) {
      setName(matched.name);
    }

    // Auto-fill phone if empty
    const matchedPhone = matched.phone_mobile || matched.phone;
    if (!phone.trim() && matchedPhone) {
      setPhone(matchedPhone);
    }
  };

  const handleClearEmployee = () => {
    setWisproEmployeeId("");
  };

  const handleSubmit = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    const normalizedName = name.trim();
    const normalizedPhone = phone.trim();

    if (!normalizedName) {
      toast.error("El nombre del gerente es requerido");
      return;
    }

    if (!normalizedPhone || normalizedPhone.replace(/\D/g, "").length < 10) {
      toast.error("El teléfono de WhatsApp debe tener al menos 10 dígitos");
      return;
    }

    setIsSubmitting(true);
    try {
      await onSaveSupervisor({
        id: editingSupervisor?.id,
        name: normalizedName,
        phone: normalizedPhone,
        wisproEmployeeId: wisproEmployeeId.trim() || null,
        active,
      });
      toast.success(
        editingSupervisor
          ? "Gerente actualizado correctamente"
          : "Gerente registrado correctamente",
      );
      onOpenChange(false);
    } catch (error) {
      toast.error(
        error instanceof Error ? error.message : "Error al guardar gerente",
      );
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-md">
        <form onSubmit={handleSubmit}>
          <DialogHeader>
            <DialogTitle>
              {editingSupervisor ? "Editar gerente" : "Nuevo gerente"}
            </DialogTitle>
            <DialogDescription>
              Configura los datos del supervisor para permitirle consultar tickets en el bot de WhatsApp.
            </DialogDescription>
          </DialogHeader>

          <div className="grid gap-4 py-4">
            <div className="space-y-1.5">
              <Label htmlFor="supervisor-name">Nombre completo</Label>
              <Input
                id="supervisor-name"
                value={name}
                onChange={(e) => setName(e.target.value)}
                placeholder="Ej. Jonathan Abreu"
                disabled={isSubmitting}
                required
              />
            </div>

            <div className="space-y-1.5">
              <Label htmlFor="supervisor-phone">WhatsApp (al menos 10 dígitos)</Label>
              <Input
                id="supervisor-phone"
                value={phone}
                onChange={(e) => setPhone(e.target.value)}
                placeholder="Ej. 04142132785 o +584142132785"
                disabled={isSubmitting}
                required
              />
              <p className="text-[11px] text-muted-foreground">
                Se guardan los últimos 10 dígitos para vincular la cuenta de WhatsApp.
              </p>
            </div>

            <div className="space-y-1.5">
              <div className="flex items-center justify-between">
                <Label htmlFor="supervisor-wispro-employee">
                  Vincular empleado Wispro (opcional)
                </Label>
                {wisproEmployeeId ? (
                  <button
                    type="button"
                    onClick={handleClearEmployee}
                    className="text-xs text-muted-foreground hover:text-foreground"
                  >
                    Desvincular
                  </button>
                ) : null}
              </div>
              <EmployeePicker
                employees={employees}
                value={wisproEmployeeId}
                onChange={handleEmployeeChange}
                disabled={isSubmitting || isLoadingEmployees}
              />
              <p className="text-[11px] text-muted-foreground">
                Permite asociar el usuario al perfil de técnico/empleado existente en Wispro.
              </p>
            </div>

            <div className="flex items-center justify-between rounded-lg border p-3">
              <div className="space-y-0.5">
                <Label htmlFor="supervisor-active" className="text-sm font-medium">
                  Estado activo
                </Label>
                <p className="text-[11px] text-muted-foreground">
                  Solo los gerentes activos pueden consultar y monitorear tickets en el bot.
                </p>
              </div>
              <Switch
                id="supervisor-active"
                checked={active}
                onCheckedChange={setActive}
                disabled={isSubmitting}
              />
            </div>
          </div>

          <DialogFooter>
            <Button
              type="button"
              variant="outline"
              onClick={() => onOpenChange(false)}
              disabled={isSubmitting}
            >
              Cancelar
            </Button>
            <Button type="submit" disabled={isSubmitting}>
              {isSubmitting
                ? "Guardando..."
                : editingSupervisor
                  ? "Guardar cambios"
                  : "Registrar gerente"}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
};
