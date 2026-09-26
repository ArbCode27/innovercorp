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
import {
  datetimeLocalToIso,
  isDatetimeRangeValid,
  toDatetimeLocalValue,
} from "@/lib/datetime-local";
import { CRM_SURFACES } from "../../_lib/crm-theme";
import {
  editCasoSchema,
  TICKET_PRIORITIES,
  ticketPriorityLabels,
  type EditCasoInput,
} from "../../_lib/wispro-caso-schema";
import { wisproCasoClient } from "../../_lib/wispro-caso-client";
import { EmployeePicker } from "../wispro/employee-picker";
import { FacadeImageField } from "../wispro/facade-image-field";
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
      windowStart: toDatetimeLocalValue(caso?.windowStart),
      windowEnd: toDatetimeLocalValue(caso?.windowEnd),
      status: caso?.status || "open",
      facadeMediaUrl: caso?.facadeMediaUrl || "",
      facadeMessageId: caso?.facadeMessageId ?? null,
    },
  });

  useEffect(() => {
    if (!caso || !open) return;
    form.reset({
      issueId: caso.wisproIssueId,
      title: caso.title || "",
      cause: caso.cause || "",
      description: caso.description || "",
      priority: caso.priority || "medium",
      employeeId: caso.employeeId || null,
      addressText: caso.addressText || "",
      mapsUrl: caso.mapsUrl || "",
      windowStart: toDatetimeLocalValue(caso.windowStart),
      windowEnd: toDatetimeLocalValue(caso.windowEnd),
      status: caso.status,
      facadeMediaUrl: caso.facadeMediaUrl || "",
      facadeMessageId: caso.facadeMessageId ?? null,
    });

    if (caso.facadeMediaUrl?.trim()) return;

    let cancelled = false;
    const loadFacade = async () => {
      try {
        const detail = await wisproCasoClient.getCrmCaso(caso.wisproIssueId);
        if (cancelled || !detail.facadeMediaUrl?.trim()) return;
        form.setValue("facadeMediaUrl", detail.facadeMediaUrl, {
          shouldDirty: false,
        });
        form.setValue("facadeMessageId", detail.facadeMessageId ?? null, {
          shouldDirty: false,
        });
      } catch {
        // El listado no trae la URL; si falla el detalle, se puede subir una nueva.
      }
    };
    void loadFacade();
    return () => {
      cancelled = true;
    };
  }, [caso, form, open]);

  const currentPriority = form.watch("priority") || "medium";
  const currentStatus = form.watch("status") || "open";
  const currentEmployeeId = form.watch("employeeId") || "";
  const facadeMediaUrl = form.watch("facadeMediaUrl") || "";
  const facadeMessageId = form.watch("facadeMessageId");

  if (!caso) return null;

  const handleSubmit = async (values: EditCasoInput) => {
    if (!isDatetimeRangeValid(values.windowStart, values.windowEnd)) {
      form.setError("windowEnd", {
        message: "El fin debe ser posterior al inicio",
      });
      return;
    }

    setIsSubmitting(true);
    try {
      const response = await wisproCasoClient.editCaso({
        ...values,
        windowStart: datetimeLocalToIso(values.windowStart),
        windowEnd: datetimeLocalToIso(values.windowEnd),
      });
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
              : "Actualiza los datos del ticket, la ventana de visita y su prioridad."}
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

          <div className="grid gap-3 sm:grid-cols-2">
            <div className="space-y-1">
              <Label htmlFor="edit-window-start">Inicio de visita</Label>
              <Input
                id="edit-window-start"
                type="datetime-local"
                {...form.register("windowStart")}
              />
              {form.formState.errors.windowStart ? (
                <p className="text-xs text-red-500">
                  {form.formState.errors.windowStart.message}
                </p>
              ) : null}
            </div>
            <div className="space-y-1">
              <Label htmlFor="edit-window-end">Fin de visita</Label>
              <Input
                id="edit-window-end"
                type="datetime-local"
                {...form.register("windowEnd")}
              />
              {form.formState.errors.windowEnd ? (
                <p className="text-xs text-red-500">
                  {form.formState.errors.windowEnd.message}
                </p>
              ) : null}
            </div>
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

          <div className="space-y-1.5">
            <Label>Foto de fachada</Label>
            <FacadeImageField
              value={{
                mediaUrl: facadeMediaUrl,
                messageId: typeof facadeMessageId === "number" ? facadeMessageId : null,
              }}
              disabled={isSubmitting}
              onChange={(next) => {
                form.setValue("facadeMediaUrl", next.mediaUrl, {
                  shouldDirty: true,
                });
                form.setValue("facadeMessageId", next.messageId, {
                  shouldDirty: true,
                });
              }}
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
