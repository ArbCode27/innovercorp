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
import { Bot, Loader2 } from "lucide-react";

interface BulkBotDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  count: number;
  isSubmitting: boolean;
  onConfirm: () => Promise<void>;
}

export const BulkBotDialog = ({
  open,
  onOpenChange,
  count,
  isSubmitting,
  onConfirm,
}: BulkBotDialogProps) => {
  const handleConfirm = async () => {
    await onConfirm();
    onOpenChange(false);
  };

  return (
    <AlertDialog open={open} onOpenChange={onOpenChange}>
      <AlertDialogContent>
        <AlertDialogHeader>
          <AlertDialogTitle className={`flex items-center gap-2 ${CRM_SURFACES.textPrimary}`}>
            <Bot className="size-5 text-crm-accent" aria-hidden="true" />
            ¿Activar Bot IA en {count} {count === 1 ? "conversación" : "conversaciones"}?
          </AlertDialogTitle>
          <AlertDialogDescription className={CRM_SURFACES.textMuted}>
            El bot de inteligencia artificial retomará el control en las{" "}
            <span className="font-semibold text-slate-800 dark:text-slate-200">
              {count} {count === 1 ? "conversación seleccionada" : "conversaciones seleccionadas"}
            </span>
            . A partir de ahora, la IA responderá automáticamente los mensajes entrantes de estos clientes.
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
            className="bg-primary text-primary-foreground hover:bg-primary/90">
            {isSubmitting ? (
              <>
                <Loader2 className="mr-2 size-4 animate-spin" />
                Activando...
              </>
            ) : (
              `Activar Bot IA (${count})`
            )}
          </AlertDialogAction>
        </AlertDialogFooter>
      </AlertDialogContent>
    </AlertDialog>
  );
};
