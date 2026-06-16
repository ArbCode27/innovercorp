"use client";

import { Search } from "lucide-react";
import { Input } from "@/components/ui/input";
import { CONVERSATION_FILTERS } from "../../_lib/constants";
import type { ConversationFilter, Label } from "../../_lib/types";
import { LabelChip } from "../shared/label-chip";

interface ConversationFiltersProps {
  searchTerm: string;
  filter: ConversationFilter;
  labels: Label[];
  selectedLabelId: number | null;
  onSearchChange: (value: string) => void;
  onFilterChange: (value: ConversationFilter) => void;
  onLabelChange: (value: number | null) => void;
}

export const ConversationFilters = ({
  searchTerm,
  filter,
  labels,
  selectedLabelId,
  onSearchChange,
  onFilterChange,
  onLabelChange,
}: ConversationFiltersProps) => (
  <div className="space-y-3 border-b border-white/10 p-4">
    <div>
      <label htmlFor="crm-conversation-search" className="sr-only">
        Buscar conversación
      </label>
      <div className="relative">
        <Search className="pointer-events-none absolute left-3 top-1/2 size-4 -translate-y-1/2 text-slate-600" />
        <Input
          id="crm-conversation-search"
          value={searchTerm}
          onChange={(event) => onSearchChange(event.target.value)}
          placeholder="Buscar..."
          className="border-white/10 bg-[#1d2130] pl-9 text-slate-100 placeholder:text-slate-600"
        />
      </div>
    </div>

    <div className="flex flex-wrap gap-1">
      {CONVERSATION_FILTERS.map((item) => (
        <button
          key={item.id}
          type="button"
          onClick={() => onFilterChange(item.id)}
          className={`rounded-full border px-3 py-1 text-xs transition focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-blue-400 ${
            filter === item.id
              ? "border-blue-400/30 bg-blue-400/10 text-blue-300"
              : "border-transparent text-slate-500 hover:text-slate-300"
          }`}
        >
          {item.label}
        </button>
      ))}
    </div>

    <div className="flex flex-wrap gap-2">
      <button
        type="button"
        onClick={() => onLabelChange(null)}
        className={`rounded-full px-2.5 py-1 text-xs ${
          selectedLabelId === null
            ? "bg-blue-400/10 text-blue-300"
            : "bg-white/5 text-slate-400"
        }`}
      >
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
