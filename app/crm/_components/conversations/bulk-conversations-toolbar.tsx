"use client";

import {
  Bot,
  CheckCircle2,
  Tag,
  UserRoundPen,
  X,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
import { CRM_SURFACES } from "../../_lib/crm-theme";

interface BulkConversationsToolbarProps {
  selectedCount: number;
  totalCount: number;
  allSelected: boolean;
  someSelected: boolean;
  isProcessing: boolean;
  onToggleSelectAll: () => void;
  onClearSelection: () => void;
  onOpenResolve: () => void;
  onOpenLabels: () => void;
  onOpenBot: () => void;
  onOpenReassign: () => void;
}

export const BulkConversationsToolbar = ({
  selectedCount,
  totalCount,
  allSelected,
  someSelected,
  isProcessing,
  onToggleSelectAll,
  onClearSelection,
  onOpenResolve,
  onOpenLabels,
  onOpenBot,
  onOpenReassign,
}: BulkConversationsToolbarProps) => {
  const hasSelection = selectedCount > 0;

  return (
    <div
      role="toolbar"
      aria-label="Acciones en lote para conversaciones"
      className="space-y-2.5 border-b p-3 bg-muted/40 dark:bg-muted/20 animate-in fade-in duration-150">
      {/* Selector maestro y contador */}
      <div className="flex items-center justify-between gap-2">
        <label className="flex items-center gap-2 cursor-pointer select-none">
          <Checkbox
            checked={allSelected ? true : someSelected ? "indeterminate" : false}
            onCheckedChange={onToggleSelectAll}
            disabled={totalCount === 0 || isProcessing}
            aria-label="Seleccionar o deseleccionar todas las conversaciones visibles"
          />
          <span className={`text-xs font-medium ${CRM_SURFACES.textPrimary}`}>
            {hasSelection
              ? `${selectedCount} de ${totalCount} seleccionadas`
              : `Seleccionar todas (${totalCount})`}
          </span>
        </label>

        {hasSelection ? (
          <Button
            type="button"
            variant="ghost"
            size="sm"
            onClick={onClearSelection}
            disabled={isProcessing}
            className="h-6 px-1.5 text-[11px] text-muted-foreground hover:text-foreground">
            <X className="mr-1 size-3" />
            Limpiar
          </Button>
        ) : null}
      </div>

      {/* Botones de acción masiva */}
      <div className="grid grid-cols-2 gap-1.5 sm:grid-cols-4">
        <Button
          type="button"
          variant="secondary"
          size="sm"
          onClick={onOpenResolve}
          disabled={!hasSelection || isProcessing}
          aria-label="Cerrar y archivar conversaciones seleccionadas"
          className="h-7 gap-1 px-1.5 text-[11px] text-emerald-700 hover:text-emerald-800 dark:text-emerald-400 dark:hover:text-emerald-300">
          <CheckCircle2 className="size-3.5 shrink-0" aria-hidden="true" />
          <span className="truncate">Cerrar ({selectedCount})</span>
        </Button>

        <Button
          type="button"
          variant="outline"
          size="sm"
          onClick={onOpenLabels}
          disabled={!hasSelection || isProcessing}
          aria-label="Etiquetar conversaciones seleccionadas"
          className="h-7 gap-1 px-1.5 text-[11px]">
          <Tag className="size-3.5 shrink-0" aria-hidden="true" />
          <span className="truncate">Etiquetar</span>
        </Button>

        <Button
          type="button"
          variant="outline"
          size="sm"
          onClick={onOpenBot}
          disabled={!hasSelection || isProcessing}
          aria-label="Activar Bot IA en conversaciones seleccionadas"
          className="h-7 gap-1 px-1.5 text-[11px]">
          <Bot className="size-3.5 shrink-0" aria-hidden="true" />
          <span className="truncate">Bot IA</span>
        </Button>

        <Button
          type="button"
          variant="outline"
          size="sm"
          onClick={onOpenReassign}
          disabled={!hasSelection || isProcessing}
          aria-label="Reasignar o liberar conversaciones seleccionadas"
          className="h-7 gap-1 px-1.5 text-[11px]">
          <UserRoundPen className="size-3.5 shrink-0" aria-hidden="true" />
          <span className="truncate">Reasignar</span>
        </Button>
      </div>
    </div>
  );
};
