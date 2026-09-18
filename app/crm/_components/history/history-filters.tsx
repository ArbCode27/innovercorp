"use client";

import { Search } from "lucide-react";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { CRM_SURFACES } from "../../_lib/crm-theme";
import { CrmButton } from "../shared/crm-button";

interface HistoryFiltersProps {
  searchTerm: string;
  from: string;
  to: string;
  onSearchChange: (value: string) => void;
  onDateRangeChange: (from: string, to: string) => void;
  onPreset: (preset: "today" | "7d" | "30d" | "all") => void;
}

export const HistoryFilters = ({
  searchTerm,
  from,
  to,
  onSearchChange,
  onDateRangeChange,
  onPreset,
}: HistoryFiltersProps) => (
  <div className={`space-y-3 border-b p-4 ${CRM_SURFACES.border}`}>
    <label htmlFor="crm-history-search" className="sr-only">
      Buscar en historial
    </label>
    <div className="relative">
      <Search
        className="pointer-events-none absolute left-3 top-1/2 size-4 -translate-y-1/2 text-slate-500"
        aria-hidden="true"
      />
      <Input
        id="crm-history-search"
        value={searchTerm}
        onChange={(event) => onSearchChange(event.target.value)}
        placeholder="Buscar cliente, teléfono o resumen..."
        className={`pl-9 ${CRM_SURFACES.border} ${CRM_SURFACES.input} ${CRM_SURFACES.textPrimary} ${CRM_SURFACES.placeholder}`}
      />
    </div>

    <div className="flex flex-wrap gap-1.5">
      <CrmButton type="button" variant="secondary" size="sm" onClick={() => onPreset("today")}>
        Hoy
      </CrmButton>
      <CrmButton type="button" variant="secondary" size="sm" onClick={() => onPreset("7d")}>
        7 días
      </CrmButton>
      <CrmButton type="button" variant="secondary" size="sm" onClick={() => onPreset("30d")}>
        30 días
      </CrmButton>
      <CrmButton type="button" variant="ghost" size="sm" onClick={() => onPreset("all")}>
        Todas
      </CrmButton>
    </div>

    <div className="grid grid-cols-2 gap-2">
      <div className="space-y-1">
        <Label htmlFor="crm-history-from" className={`text-[11px] ${CRM_SURFACES.textMuted}`}>
          Desde
        </Label>
        <Input
          id="crm-history-from"
          type="date"
          value={from}
          onChange={(event) => onDateRangeChange(event.target.value, to)}
          className={CRM_SURFACES.input}
        />
      </div>
      <div className="space-y-1">
        <Label htmlFor="crm-history-to" className={`text-[11px] ${CRM_SURFACES.textMuted}`}>
          Hasta
        </Label>
        <Input
          id="crm-history-to"
          type="date"
          value={to}
          min={from || undefined}
          onChange={(event) => onDateRangeChange(from, event.target.value)}
          className={CRM_SURFACES.input}
        />
      </div>
    </div>
  </div>
);
