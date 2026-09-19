"use client";

import {
  Check,
  EllipsisVertical,
  FileText,
  RotateCcw,
  UserCheck,
  UserPlus,
  Wrench,
} from "lucide-react";
import {
  Drawer,
  DrawerClose,
  DrawerContent,
  DrawerDescription,
  DrawerHeader,
  DrawerTitle,
  DrawerTrigger,
} from "@/components/ui/drawer";
import { Button } from "@/components/ui/button";
import { CRM_SURFACES } from "../../_lib/crm-theme";

interface ConversationActionsDrawerProps {
  isHumanMode: boolean;
  isResolving: boolean;
  canAssignAgent: boolean;
  assignLabel: string;
  onTakeControl: () => void;
  onReactivateBot: () => void;
  onResolve: () => void;
  onOpenNote: () => void;
  onOpenAssign: () => void;
  onOpenCreateCaso?: () => void;
}

export const ConversationActionsDrawer = ({
  isHumanMode,
  isResolving,
  canAssignAgent,
  assignLabel,
  onTakeControl,
  onReactivateBot,
  onResolve,
  onOpenNote,
  onOpenAssign,
  onOpenCreateCaso,
}: ConversationActionsDrawerProps) => (
  <Drawer>
    <DrawerTrigger asChild>
      <Button
        type="button"
        variant="ghost"
        size="icon"
        className="md:hidden"
        aria-label="Abrir acciones de conversación">
        <EllipsisVertical className="size-4" aria-hidden="true" />
      </Button>
    </DrawerTrigger>

    <DrawerContent className={`rounded-t-3xl ${CRM_SURFACES.elevatedTranslucent} ${CRM_SURFACES.textPrimary}`}>
      <DrawerHeader>
        <DrawerTitle className={CRM_SURFACES.textPrimary}>
          Acciones de conversación
        </DrawerTitle>
        <DrawerDescription className={CRM_SURFACES.textMuted}>
          Gestiona control, notas y seguimiento del cliente.
        </DrawerDescription>
      </DrawerHeader>

      <div className="grid gap-2 p-4 pt-0">
        {isHumanMode ? (
          <DrawerClose asChild>
            <Button
              type="button"
              variant="outline"
              className="w-full justify-start"
              onClick={onReactivateBot}>
              <RotateCcw className="size-4" aria-hidden="true" />
              Reactivar bot
            </Button>
          </DrawerClose>
        ) : (
          <DrawerClose asChild>
            <Button
              type="button"
              variant="destructive"
              className="w-full justify-start"
              onClick={onTakeControl}>
              <UserCheck className="size-4" aria-hidden="true" />
              Tomar control
            </Button>
          </DrawerClose>
        )}

        <DrawerClose asChild>
          <Button
            type="button"
            variant="success"
            className="w-full justify-start"
            disabled={isResolving}
            onClick={onResolve}>
            <Check className="size-4" aria-hidden="true" />
            {isResolving ? "Archivando..." : "Resolver"}
          </Button>
        </DrawerClose>

        <DrawerClose asChild>
          <Button
            type="button"
            variant="secondary"
            className="w-full justify-start"
            onClick={onOpenNote}>
            <FileText className="size-4" aria-hidden="true" />
            Agregar nota
          </Button>
        </DrawerClose>

        {canAssignAgent ? (
          <DrawerClose asChild>
            <Button
              type="button"
              variant="secondary"
              className="w-full justify-start"
              onClick={onOpenAssign}>
              <UserPlus className="size-4" aria-hidden="true" />
              {assignLabel}
            </Button>
          </DrawerClose>
        ) : null}

        {onOpenCreateCaso ? (
          <DrawerClose asChild>
            <Button
              type="button"
              variant="secondary"
              className="w-full justify-start"
              onClick={onOpenCreateCaso}>
              <Wrench className="size-4" aria-hidden="true" />
              Ticket
            </Button>
          </DrawerClose>
        ) : null}
      </div>
    </DrawerContent>
  </Drawer>
);
