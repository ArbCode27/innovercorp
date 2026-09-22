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
  CLIENT_STATUS_OPTIONS,
  finalizeCasoFormSchema,
  type FinalizeCasoFormInput,
} from "../../_lib/wispro-caso-schema";
import { wisproCasoClient } from "../../_lib/wispro-caso-client";
import type { CrmWisproCaso } from "@/lib/wispro-types";

interface TicketFinalizeDialogProps {
  caso: CrmWisproCaso | null;
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onFinalized: (caso: CrmWisproCaso, orderOk?: boolean | null, orderError?: string) => void;
}

export const TicketFinalizeDialog = ({
  caso,
  open,
  onOpenChange,
  onFinalized,
}: TicketFinalizeDialogProps) => {
  const [isSubmitting, setIsSubmitting] = useState(false);

  const form = useForm<FinalizeCasoFormInput>({
    resolver: zodResolver(finalizeCasoFormSchema),
    defaultValues: {
      issueId: caso?.wisproIssueId || "",
      resolutionObservation: "",
      resolutionSolution: "",
      clientStatus: "Operativo y conforme",
    },
  });

  useEffect(() => {
    if (!caso) return;
    form.reset({
      issueId: caso.wisproIssueId,
      resolutionObservation: caso.resolutionObservation || "",
      resolutionSolution: caso.resolutionSolution || "",
      clientStatus: caso.clientStatus || "Operativo y conforme",
    });
  }, [caso, form]);

  if (!caso) return null;

  const handleSubmit = async (values: FinalizeCasoFormInput) => {
    setIsSubmitting(true);
    try {
      const result = await wisproCasoClient.manageCaso({
        action: "finalize",
        issueId: values.issueId,
        resolutionObservation: values.resolutionObservation,
        resolutionSolution: values.resolutionSolution,
        clientStatus: values.clientStatus,
      });

      if (result.caso) {
        onFinalized(result.caso, result.orden?.ok, result.orden?.error);
        if (result.orden?.ok === false) {
          toast.warning(
            result.orden.error ||
              "El ticket se cerró, pero la orden no se pudo finalizar.",
          );
        } else {
          toast.success("Ticket finalizado y verificado correctamente.");
        }
        onOpenChange(false);
      }
    } catch (error) {
      const message =
        error instanceof Error ? error.message : "No se pudo finalizar el ticket";
      toast.error(message);
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleClose = () => {
    if (isSubmitting) return;
    onOpenChange(false);
  };

  const selectedStatus = form.watch("clientStatus");
  const ticketNumber = caso.wisproPublicId != null ? `#${caso.wisproPublicId}` : "";

  return (
    <Dialog open={open} onOpenChange={handleClose}>
      <DialogContent className="max-h-[90vh] overflow-y-auto sm:max-w-lg">
        <DialogHeader>
          <DialogTitle>Finalizar y Verificar Ticket {ticketNumber}</DialogTitle>
          <DialogDescription>
            Para corroborar que el soporte técnico se realizó correctamente, es obligatorio
            registrar el diagnóstico, la solución aplicada y el estado final del cliente.
          </DialogDescription>
        </DialogHeader>

        <form onSubmit={form.handleSubmit(handleSubmit)} className="space-y-4 py-2">
          <div className="rounded-xl border border-muted bg-muted/40 p-3 text-xs space-y-1">
            <p>
              <strong className="text-foreground">Cliente:</strong> {caso.clientName || "N/D"}
            </p>
            <p>
              <strong className="text-foreground">Falla reportada:</strong> {caso.cause || caso.title || "Visita técnica"}
            </p>
            {caso.employeeName ? (
              <p>
                <strong className="text-foreground">Técnico asignado:</strong> {caso.employeeName}
              </p>
            ) : null}
          </div>

          <div className="space-y-1.5">
            <Label htmlFor="finalize-observation" className="text-sm font-medium">
              1. Observación / Diagnóstico en sitio <span className="text-destructive">*</span>
            </Label>
            <Textarea
              id="finalize-observation"
              rows={3}
              placeholder="Ej: Pérdida óptica por conector mecánico quebrado en roseta, potencia en -31 dBm..."
              aria-label="Observación o diagnóstico del caso"
              {...form.register("resolutionObservation")}
            />
            {form.formState.errors.resolutionObservation ? (
              <p className="text-xs text-destructive">
                {form.formState.errors.resolutionObservation.message}
              </p>
            ) : (
              <p className={`text-[11px] ${CRM_SURFACES.textMuted}`}>
                Describe la causa real o el problema detectado al llegar al domicilio.
              </p>
            )}
          </div>

          <div className="space-y-1.5">
            <Label htmlFor="finalize-solution" className="text-sm font-medium">
              2. Solución técnica aplicada <span className="text-destructive">*</span>
            </Label>
            <Textarea
              id="finalize-solution"
              rows={3}
              placeholder="Ej: Se rehizo empalme mecánico, se limpió fibra y potencia quedó normalizada en -19 dBm..."
              aria-label="Solución técnica aplicada"
              {...form.register("resolutionSolution")}
            />
            {form.formState.errors.resolutionSolution ? (
              <p className="text-xs text-destructive">
                {form.formState.errors.resolutionSolution.message}
              </p>
            ) : (
              <p className={`text-[11px] ${CRM_SURFACES.textMuted}`}>
                Describe detalladamente qué trabajo o reemplazo se llevó a cabo.
              </p>
            )}
          </div>

          <div className="space-y-1.5">
            <Label htmlFor="finalize-status" className="text-sm font-medium">
              3. Estado del cliente / servicio <span className="text-destructive">*</span>
            </Label>
            <Select
              value={selectedStatus}
              onValueChange={(value) => form.setValue("clientStatus", value, { shouldValidate: true })}>
              <SelectTrigger id="finalize-status" aria-label="Estado del cliente">
                <SelectValue placeholder="Selecciona el estado..." />
              </SelectTrigger>
              <SelectContent>
                {CLIENT_STATUS_OPTIONS.map((opt) => (
                  <SelectItem key={opt.value} value={opt.value}>
                    {opt.label}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
            {form.formState.errors.clientStatus ? (
              <p className="text-xs text-destructive">
                {form.formState.errors.clientStatus.message}
              </p>
            ) : (
              <p className={`text-[11px] ${CRM_SURFACES.textMuted}`}>
                Indica si el servicio quedó operativo y si el cliente confirmó su conformidad.
              </p>
            )}
          </div>

          <DialogFooter className="mt-6 gap-2 sm:gap-0">
            <Button
              type="button"
              variant="secondary"
              onClick={handleClose}
              disabled={isSubmitting}>
              Cancelar
            </Button>
            <Button
              type="submit"
              variant="success"
              disabled={isSubmitting}>
              {isSubmitting ? "Finalizando..." : "Confirmar y Cerrar Ticket"}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
};
