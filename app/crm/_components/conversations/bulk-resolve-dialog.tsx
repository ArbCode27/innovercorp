"use client";

import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import { CRM_SURFACES } from "../../_lib/crm-theme";
import { Loader2 } from "lucide-react";

interface BulkResolveDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  count: number;
  isSubmitting: boolean;
  onConfirm: () => Promise<void>;
}

export const BulkResolveDialog = ({
  open,
  onOpenChange,
  count,
  isSubmitting,
  onConfirm,
}: BulkResolveDialogProps) => {
  const handleConfirm = async () => {
    await onConfirm();
    onOpenChange(false);
  };

  return (
    <AlertDialog open={open} onOpenChange={onOpenChange}>
      <AlertDialogContent>
        <AlertDialogHeader>
          <AlertDialogTitle className={CRM_SURFACES.textPrimary}>
            ¿Cerrar y archivar {count} {count === 1 ? "conversación" : "conversaciones"}?
          </AlertDialogTitle>
          <AlertDialogDescription className={CRM_SURFACES.textMuted}>
            Se guardará el historial completo de las{" "}
            <span className="font-semibold text-slate-800 dark:text-slate-200">
              {count} {count === 1 ? "conversación seleccionada" : "conversaciones seleccionadas"}
            </span>{" "}
            en el módulo de Historial y se removerán de tu bandeja activa. Los tickets asociados
            abiertos pasarán a estado Resuelto. Esta acción no se puede deshacer.
          </AlertDialogDescription>
        </AlertDialogHeader>
        <AlertDialogFooter>
          <AlertDialogCancel disabled={isSubmitting}>Cancelar</AlertDialogCancel>
          <AlertDialogAction
            disabled={isSubmitting || count === 0}
            onClick={(event) => {
              event.preventDefault();
              void handleConfirm();
            }}
            className="bg-emerald-600 text-white hover:bg-emerald-700 dark:bg-emerald-600 dark:hover:bg-emerald-500">
            {isSubmitting ? (
              <>
                <Loader2 className="mr-2 size-4 animate-spin" />
                Cerrando...
              </>
            ) : (
              `Cerrar y archivar (${count})`
            )}
          </AlertDialogAction>
        </AlertDialogFooter>
      </AlertDialogContent>
    </AlertDialog>
  );
};
