"use client";

import { ChevronLeft, ChevronRight, History } from "lucide-react";
import type { HistoryDateGroup } from "../../_lib/history-utils";
import { CRM_SURFACES } from "../../_lib/crm-theme";
import { EmptyState } from "../shared/empty-state";
import { Button } from "@/components/ui/button";
import { HistoryListItem } from "./history-list-item";

interface HistoryListProps {
  groups: HistoryDateGroup[];
  selectedHistoryId: number | null;
  isRefreshing?: boolean;
  page: number;
  pageCount: number;
  total: number;
  pageSize: number;
  canPrev: boolean;
  canNext: boolean;
  onPrev: () => void;
  onNext: () => void;
  onSelect: (id: number) => void;
}

export const HistoryList = ({
  groups,
  selectedHistoryId,
  isRefreshing = false,
  page,
  pageCount,
  total,
  pageSize,
  canPrev,
  canNext,
  onPrev,
  onNext,
  onSelect,
}: HistoryListProps) => {
  if (!groups.length) {
    return (
      <EmptyState
        icon={History}
        title="Sin historial"
        description="No hay conversaciones resueltas para este rango. Prueba otras fechas o quita el filtro."
      />
    );
  }

  const fromItem = (page - 1) * pageSize + 1;
  const toItem = Math.min(page * pageSize, total);

  return (
    <div className="flex min-h-0 flex-1 flex-col">
      <div
        className={`crm-scrollbar min-h-0 flex-1 space-y-1 overflow-y-auto p-2 ${
          isRefreshing ? "opacity-70" : ""
        }`}>
        {groups.map((group) => (
          <section key={group.dateKey} aria-labelledby={`history-group-${group.dateKey}`}>
            <header
              id={`history-group-${group.dateKey}`}
              className={`sticky top-0 z-10 rounded-2xl px-3 py-2 ${CRM_SURFACES.elevatedTranslucent}`}>
              <p className={`text-[11px] font-semibold uppercase tracking-wide ${CRM_SURFACES.textMuted}`}>
                Resueltas · {group.label}
              </p>
              <p className={`text-[10px] ${CRM_SURFACES.textLabel}`}>
                {group.entries.length}{" "}
                {group.entries.length === 1 ? "conversación" : "conversaciones"}
              </p>
            </header>

            <ul role="list">
              {group.entries.map((entry) => (
                <li key={entry.id}>
                  <HistoryListItem
                    entry={entry}
                    isActive={selectedHistoryId === entry.id}
                    onSelect={onSelect}
                  />
                </li>
              ))}
            </ul>
          </section>
        ))}
      </div>

      <nav
        className={`flex items-center justify-between gap-2 border-t px-3 py-2 ${CRM_SURFACES.border}`}
        aria-label="Paginación del historial">
        <p className={`text-[11px] ${CRM_SURFACES.textMuted}`}>
          {fromItem}–{toItem} de {total}
        </p>
        <div className="flex items-center gap-1">
          <Button
            type="button"
            variant="ghost"
            size="sm"
            onClick={onPrev}
            disabled={!canPrev || isRefreshing}
            aria-label="Página anterior">
            <ChevronLeft className="size-4" />
          </Button>
          <span className={`min-w-12 text-center text-[11px] ${CRM_SURFACES.textSecondary}`}>
            {page}/{pageCount}
          </span>
          <Button
            type="button"
            variant="ghost"
            size="sm"
            onClick={onNext}
            disabled={!canNext || isRefreshing}
            aria-label="Página siguiente">
            <ChevronRight className="size-4" />
          </Button>
        </div>
      </nav>
    </div>
  );
};
