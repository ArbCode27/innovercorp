"use client";

import { Search } from "lucide-react";
import { Input } from "@/components/ui/input";
import { cn } from "@/lib/utils";
import { CONVERSATION_FILTERS } from "../../_lib/constants";
import { CRM_FOCUS_RING, CRM_SURFACES } from "../../_lib/crm-theme";
import type { ConversationFilterCounts } from "../../_lib/conversation-filter-utils";
import type { ConversationFilter, Label } from "../../_lib/types";
import { CrmFilterChip } from "../shared/crm-filter-chip";
import { LabelChip } from "../shared/label-chip";

interface ConversationFiltersProps {
  searchTerm: string;
  filter: ConversationFilter;
  counts: ConversationFilterCounts;
  labels: Label[];
  selectedLabelId: number | null;
  onSearchChange: (value: string) => void;
  onFilterChange: (value: ConversationFilter) => void;
  onLabelChange: (value: number | null) => void;
}

export const ConversationFilters = ({
  searchTerm,
  filter,
  counts,
  labels,
  selectedLabelId,
  onSearchChange,
  onFilterChange,
  onLabelChange,
}: ConversationFiltersProps) => (
  <div className={`space-y-3 border-b p-4 ${CRM_SURFACES.border}`}>
    <div>
      <label htmlFor="crm-conversation-search" className="sr-only">
        Buscar conversación
      </label>
      <div className="relative">
        <Search
          className="pointer-events-none absolute left-3 top-1/2 size-4 -translate-y-1/2 text-slate-500 dark:text-slate-500"
          aria-hidden="true"
        />
        <Input
          id="crm-conversation-search"
          value={searchTerm}
          onChange={(event) => onSearchChange(event.target.value)}
          placeholder="Buscar..."
          className={`pl-9 ${CRM_SURFACES.border} ${CRM_SURFACES.input} ${CRM_SURFACES.textPrimary} ${CRM_SURFACES.placeholder}`}
        />
      </div>
    </div>

    <div className="flex flex-wrap gap-1">
      {CONVERSATION_FILTERS.map((item) => (
        <CrmFilterChip
          key={item.id}
          label={item.label}
          count={counts[item.id]}
          isActive={filter === item.id}
          onClick={() => onFilterChange(item.id)}
        />
      ))}
    </div>

    <div className="flex flex-wrap gap-2">
      <button
        type="button"
        onClick={() => onLabelChange(null)}
        aria-pressed={selectedLabelId === null}
        className={cn(
          CRM_FOCUS_RING,
          "rounded-full px-2.5 py-1 text-xs font-medium transition",
          selectedLabelId === null
            ? "bg-blue-100 text-blue-900 dark:bg-blue-950/70 dark:text-blue-100"
            : `bg-slate-100 text-slate-600 hover:text-slate-900 dark:bg-white/5 dark:text-slate-400 dark:hover:text-slate-200`,
        )}>
        Todas
      </button>
      {labels.map((label) => (
        <LabelChip
          key={label.id}
          label={label}
          selected={selectedLabelId === label.id}
          onClick={() => onLabelChange(label.id)}
        />
      ))}
    </div>
  </div>
);
