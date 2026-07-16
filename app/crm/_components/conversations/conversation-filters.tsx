"use client";

import { useMemo, useState } from "react";
import { Check, ChevronDown, Search } from "lucide-react";
import { Input } from "@/components/ui/input";
import { Command, CommandEmpty, CommandGroup, CommandInput, CommandItem, CommandList } from "@/components/ui/command";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { cn } from "@/lib/utils";
import { CONVERSATION_FILTERS } from "../../_lib/constants";
import { CRM_FOCUS_RING, CRM_SURFACES } from "../../_lib/crm-theme";
import type { ConversationFilterCounts } from "../../_lib/conversation-filter-utils";
import type { ConversationFilter, Label } from "../../_lib/types";
import { CrmFilterChip } from "../shared/crm-filter-chip";

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
}: ConversationFiltersProps) => {
  const [isLabelMenuOpen, setIsLabelMenuOpen] = useState(false);
  const selectedLabel = useMemo(
    () => labels.find((label) => label.id === selectedLabelId) || null,
    [labels, selectedLabelId],
  );

  return (
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

    <div className="crm-scrollbar flex gap-2 overflow-x-auto pb-1">
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

    <div>
      <Popover open={isLabelMenuOpen} onOpenChange={setIsLabelMenuOpen}>
        <PopoverTrigger asChild>
          <button
            type="button"
            aria-label="Filtrar por etiqueta"
            className={cn(
              CRM_FOCUS_RING,
              "inline-flex h-9 w-full items-center justify-between rounded-xl border px-3 text-sm font-medium transition",
              "border-slate-700/70 bg-[#111827] text-slate-100 hover:border-slate-500/80",
            )}>
            <span className="truncate">
              {selectedLabel ? `Etiqueta: ${selectedLabel.name}` : "Todas las etiquetas"}
            </span>
            <ChevronDown className="size-4 shrink-0 text-slate-400" aria-hidden="true" />
          </button>
        </PopoverTrigger>

        <PopoverContent
          align="start"
          className={`w-[min(22rem,calc(100vw-2rem))] border p-0 ${CRM_SURFACES.border} ${CRM_SURFACES.elevated} ${CRM_SURFACES.textPrimary}`}>
          <Command>
            <CommandInput placeholder="Buscar etiqueta..." />
            <CommandList>
              <CommandEmpty>Sin coincidencias</CommandEmpty>
              <CommandGroup heading="Etiquetas">
                <CommandItem
                  value="todas"
                  className="data-[selected=true]:bg-blue-600/25 data-[selected=true]:text-blue-100"
                  onSelect={() => {
                    onLabelChange(null);
                    setIsLabelMenuOpen(false);
                  }}>
                  <Check
                    className={cn(
                      "size-4",
                      selectedLabelId === null ? "opacity-100" : "opacity-0",
                    )}
                    aria-hidden="true"
                  />
                  Todas las etiquetas
                </CommandItem>
                {labels.map((label) => (
                  <CommandItem
                    key={label.id}
                    value={label.name}
                    className="data-[selected=true]:bg-blue-600/25 data-[selected=true]:text-blue-100"
                    onSelect={() => {
                      onLabelChange(label.id);
                      setIsLabelMenuOpen(false);
                    }}>
                    <Check
                      className={cn(
                        "size-4",
                        selectedLabelId === label.id ? "opacity-100" : "opacity-0",
                      )}
                      aria-hidden="true"
                    />
                    <span
                      className="size-2 shrink-0 rounded-full"
                      style={{ backgroundColor: label.color }}
                      aria-hidden="true"
                    />
                    {label.name}
                  </CommandItem>
                ))}
              </CommandGroup>
            </CommandList>
          </Command>
        </PopoverContent>
      </Popover>
    </div>
  </div>
  );
};
