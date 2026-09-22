"use client";

import { useEffect, useState } from "react";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { toast } from "sonner";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
import { Button } from "@/components/ui/button";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { CRM_SURFACES } from "../../_lib/crm-theme";
import {
  editCasoSchema,
  TICKET_PRIORITIES,
  ticketPriorityLabels,
  type EditCasoInput,
} from "../../_lib/wispro-caso-schema";
import { wisproCasoClient } from "../../_lib/wispro-caso-client";
import { EmployeePicker } from "../wispro/employee-picker";
import type { CrmWisproCaso, WisproEmployee } from "@/lib/wispro-types";

interface TicketEditDialogProps {
  caso: CrmWisproCaso | null;
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onSaved: (caso: CrmWisproCaso) => void;
  employees: WisproEmployee[];
}

export const TicketEditDialog = ({
  caso,
  open,
  onOpenChange,
  onSaved,
  employees,
}: TicketEditDialogProps) => {
  const [isSubmitting, setIsSubmitting] = useState(false);

  const form = useForm<EditCasoInput>({
    resolver: zodResolver(editCasoSchema),
    defaultValues: {
      issueId: caso?.wisproIssueId || "",
      title: caso?.title || "",
      cause: caso?.cause || "",
      description: caso?.description || "",
      priority: caso?.priority || "medium",
      employeeId: caso?.employeeId || null,
      addressText: caso?.addressText || "",
      mapsUrl: caso?.mapsUrl || "",
      status: caso?.status || "open",
    },
  });

  useEffect(() => {
    if (!caso) return;
    form.reset({
      issueId: caso.wisproIssueId,
      title: caso.title || "",
      cause: caso.cause || "",
      description: caso.description || "",
      priority: caso.priority || "medium",
      employeeId: caso.employeeId || null,
      addressText: caso.addressText || "",
      mapsUrl: caso.mapsUrl || "",
      status: caso.status,
    });
  }, [caso, form]);

  if (!caso) return null;

  const handleSubmit = async (values: EditCasoInput) => {
    setIsSubmitting(true);
    try {
      const response = await wisproCasoClient.editCaso(values);
      if (response.caso) {
        onSaved(response.caso);
        toast.success("Ticket actualizado correctamente.");
        onOpenChange(false);
      }
    } catch (error) {
      const message =
        error instanceof Error ? error.message : "No se pudo actualizar el ticket";
      toast.error(message);
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleClose = () => {
    if (isSubmitting) return;
    onOpenChange(false);
  };

  const currentPriority = form.watch("priority") || "medium";
  const currentStatus = form.watch("status") || "open";
  const currentEmployeeId = form.watch("employeeId") || "";

  return (
    <Dialog open={open} onOpenChange={handleClose}>
      <DialogContent className="max-h-[90vh] overflow-y-auto sm:max-w-xl">
        <DialogHeader>
          <DialogTitle>
            Editar Ticket {caso.wisproPublicId != null ? `#${caso.wisproPublicId}` : ""}
          </DialogTitle>
          <DialogDescription>
            {caso.clientName
              ? `Cliente: ${caso.clientName}`
              : "Actualiza los datos del ticket y su prioridad."}
          </DialogDescription>
        </DialogHeader>

        <form onSubmit={form.handleSubmit(handleSubmit)} className="space-y-4">
          <div className="grid gap-3 sm:grid-cols-2">
            <div className="space-y-1">
              <Label htmlFor="edit-title">Título / Motivo *</Label>
              <Input
                id="edit-title"
                placeholder="Motivo del ticket"
                {...form.register("title")}
              />
              {form.formState.errors.title ? (
                <p className="text-xs text-red-500">
                  {form.formState.errors.title.message}
                </p>
              ) : null}
            </div>

            <div className="space-y-1">
              <Label htmlFor="edit-priority">Prioridad *</Label>
              <Select
                value={currentPriority}
                onValueChange={(val) =>
                  form.setValue("priority", val as EditCasoInput["priority"], {
                    shouldDirty: true,
                  })
                }>
                <SelectTrigger id="edit-priority">
                  <SelectValue placeholder="Selecciona prioridad" />
                </SelectTrigger>
                <SelectContent>
                  {TICKET_PRIORITIES.map((level) => (
                    <SelectItem key={level} value={level}>
                      {ticketPriorityLabels[level]}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          </div>

          <div className="grid gap-3 sm:grid-cols-2">
            <div className="space-y-1">
              <Label htmlFor="edit-status">Estado</Label>
              <Select
                value={currentStatus}
                onValueChange={(val) =>
                  form.setValue("status", val as EditCasoInput["status"], {
                    shouldDirty: true,
                  })
                }>
                <SelectTrigger id="edit-status">
                  <SelectValue placeholder="Estado" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="open">Abierto</SelectItem>
                  <SelectItem value="scheduled">Agendado</SelectItem>
                  <SelectItem value="done">Cerrado</SelectItem>
                  <SelectItem value="cancelled">Cancelado</SelectItem>
                </SelectContent>
              </Select>
            </div>

            <div className="space-y-1">
              <Label>Técnico Asignado</Label>
              <EmployeePicker
                employees={employees}
                value={currentEmployeeId}
                onChange={(employeeId) =>
                  form.setValue("employeeId", employeeId || null, {
                    shouldDirty: true,
                  })
                }
              />
            </div>
          </div>

          <div className="space-y-1">
            <Label htmlFor="edit-cause">Causa específica</Label>
            <Input
              id="edit-cause"
              placeholder="Causa o detalle breve"
              {...form.register("cause")}
            />
          </div>

          <div className="space-y-1">
            <Label htmlFor="edit-description">Descripción</Label>
            <Textarea
              id="edit-description"
              rows={3}
              placeholder="Detalles sobre el problema o la orden de trabajo"
              {...form.register("description")}
            />
          </div>

          <div className="space-y-1">
            <Label htmlFor="edit-address">Dirección / Ubicación</Label>
            <Input
              id="edit-address"
              placeholder="Dirección del cliente"
              {...form.register("addressText")}
            />
          </div>

          <div className="space-y-1">
            <Label htmlFor="edit-maps">Enlace de Google Maps</Label>
            <Input
              id="edit-maps"
              placeholder="https://maps.google.com/..."
              {...form.register("mapsUrl")}
            />
          </div>

          <DialogFooter className="pt-2">
            <Button
              type="button"
              variant="secondary"
              onClick={handleClose}
              disabled={isSubmitting}>
              Cancelar
            </Button>
            <Button type="submit" disabled={isSubmitting}>
              {isSubmitting ? "Guardando..." : "Guardar cambios"}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
};
