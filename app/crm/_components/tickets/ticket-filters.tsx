"use client";

import { useMemo } from "react";
import {
  AlertTriangle,
  ArrowDown,
  ArrowUp,
  Check,
  Flame,
  RotateCcw,
  Search,
  UserRound,
  UserX,
  X,
} from "lucide-react";
import { Input } from "@/components/ui/input";
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
  DEFAULT_TICKET_STATUS_FILTER,
  TICKET_PRIORITIES,
  ticketPriorityLabels,
} from "../../_lib/wispro-caso-schema";
import type { TicketPriority, WisproEmployee } from "@/lib/wispro-types";

export { DEFAULT_TICKET_STATUS_FILTER };

interface StatusTabConfig {
  id: string;
  label: string;
  dotColor?: string;
}

const STATUS_TABS: StatusTabConfig[] = [
  { id: "all", label: "Todos" },
  { id: "open", label: "Abiertos", dotColor: "bg-amber-400 shadow-amber-400/50" },
  { id: "scheduled", label: "Agendados", dotColor: "bg-blue-400 shadow-blue-400/50" },
  { id: "done", label: "Cerrados", dotColor: "bg-emerald-400 shadow-emerald-400/50" },
  { id: "cancelled", label: "Cancelados", dotColor: "bg-rose-400 shadow-rose-400/50" },
];

const PRIORITY_ICONS: Record<TicketPriority, typeof Flame> = {
  urgent: Flame,
  high: AlertTriangle,
  medium: ArrowUp,
  low: ArrowDown,
};

const PRIORITY_DOT_COLORS: Record<TicketPriority, string> = {
  urgent: "bg-red-500",
  high: "bg-amber-500",
  medium: "bg-blue-500",
  low: "bg-slate-400",
};

interface TicketFiltersProps {
  searchQuery: string;
  onSearchChange: (query: string) => void;
  statusFilter: string;
  onStatusChange: (status: string) => void;
  priorityFilter: string;
  onPriorityChange: (priority: string) => void;
  employeeFilter: string;
  onEmployeeChange: (employeeId: string) => void;
  employees: WisproEmployee[];
  totalCount: number;
  filteredCount: number;
  statusCounts?: Record<string, number>;
  onReset: () => void;
}

export const TicketFilters = ({
  searchQuery,
  onSearchChange,
  statusFilter,
  onStatusChange,
  priorityFilter,
  onPriorityChange,
  employeeFilter,
  onEmployeeChange,
  employees,
  totalCount,
  filteredCount,
  statusCounts,
  onReset,
}: TicketFiltersProps) => {
  const hasActiveFilters =
    Boolean(searchQuery.trim()) ||
    statusFilter !== DEFAULT_TICKET_STATUS_FILTER ||
    priorityFilter !== "all" ||
    employeeFilter !== "all";

  const selectedEmployeeName = useMemo(() => {
    if (employeeFilter === "all" || employeeFilter === "unassigned") return null;
    return employees.find((emp) => emp.id === employeeFilter)?.name || null;
  }, [employees, employeeFilter]);

  const activeFiltersCount =
    (searchQuery.trim() ? 1 : 0) +
    (statusFilter !== DEFAULT_TICKET_STATUS_FILTER ? 1 : 0) +
    (priorityFilter !== "all" ? 1 : 0) +
    (employeeFilter !== "all" ? 1 : 0);

  return (
    <div
      className={`rounded-2xl border border-border/80 bg-card/60 p-3 shadow-xs backdrop-blur-md md:p-4 ${CRM_SURFACES.elevated}`}>
      {/* Fila 1: Pestañas de Estado Rápidas + Contador Global */}
      <div className="flex flex-col gap-3 pb-3 border-b border-border/60 sm:flex-row sm:items-center sm:justify-between">
        {/* Pestañas de estado estilo Segmented Controls */}
        <div className="crm-scrollbar flex items-center gap-1.5 overflow-x-auto pb-1 sm:pb-0">
          {STATUS_TABS.map((tab) => {
            const isActive = statusFilter === tab.id;
            const count = statusCounts ? statusCounts[tab.id] : undefined;

            return (
              <button
                key={tab.id}
                type="button"
                onClick={() => onStatusChange(tab.id)}
                className={`inline-flex shrink-0 items-center gap-1.5 rounded-xl px-3 py-1.5 text-xs font-medium transition-all ${
                  isActive
                    ? "border border-primary/30 bg-primary/15 text-primary shadow-xs"
                    : "border border-border/60 bg-background/40 text-muted-foreground hover:bg-accent/60 hover:text-foreground"
                }`}>
                {tab.dotColor ? (
                  <span
                    className={`size-2 rounded-full shadow-xs ${tab.dotColor}`}
                    aria-hidden="true"
                  />
                ) : null}
                <span>{tab.label}</span>
                {count !== undefined ? (
                  <span
                    className={`ml-0.5 rounded-md px-1.5 py-0.2 text-[10px] tabular-nums font-semibold ${
                      isActive
                        ? "bg-primary/20 text-primary"
                        : "bg-muted text-muted-foreground"
                    }`}>
                    {count}
                  </span>
                ) : null}
              </button>
            );
          })}
        </div>

        {/* Resumen de tickets y contador */}
        <div className="flex shrink-0 items-center justify-between gap-2.5 sm:justify-end">
          <div className="flex items-center gap-1.5 text-xs text-muted-foreground">
            <span
              className={`size-2 rounded-full ${
                filteredCount > 0 ? "bg-emerald-500 animate-pulse" : "bg-slate-400"
              }`}
              aria-hidden="true"
            />
            {filteredCount !== totalCount ? (
              <span>
                Mostrando{" "}
                <strong className={`font-semibold ${CRM_SURFACES.textPrimary}`}>
                  {filteredCount}
                </strong>{" "}
                de{" "}
                <strong className={`font-semibold ${CRM_SURFACES.textPrimary}`}>
                  {totalCount}
                </strong>
              </span>
            ) : (
              <span>
                <strong className={`font-semibold ${CRM_SURFACES.textPrimary}`}>
                  {totalCount}
                </strong>{" "}
                tickets
              </span>
            )}
          </div>

          {hasActiveFilters ? (
            <Button
              type="button"
              variant="ghost"
              size="sm"
              onClick={onReset}
              className="h-7 gap-1 rounded-lg px-2 text-xs text-muted-foreground hover:bg-destructive/10 hover:text-destructive transition-colors">
              <RotateCcw className="size-3" />
              <span>Limpiar ({activeFiltersCount})</span>
            </Button>
          ) : null}
        </div>
      </div>

      {/* Fila 2: Barra de Búsqueda + Filtros secundarios compactos */}
      <div className="flex flex-wrap items-center gap-2.5 pt-1">
        {/* Campo de búsqueda con icono y botón para borrar */}
        <div className="relative min-w-[220px] flex-1 sm:max-w-xs md:max-w-sm">
          <Search
            className="pointer-events-none absolute left-3 top-1/2 size-4 -translate-y-1/2 text-muted-foreground"
            aria-hidden="true"
          />
          <Input
            value={searchQuery}
            onChange={(e) => onSearchChange(e.target.value)}
            placeholder="Buscar por cliente, #, causa, técnico..."
            aria-label="Buscar tickets"
            className={`h-9 rounded-xl pl-9 pr-8 text-xs sm:text-sm bg-background/50 ${CRM_SURFACES.border} ${CRM_SURFACES.textPrimary} ${CRM_SURFACES.placeholder} focus:border-primary/50 transition-all`}
          />
          {searchQuery ? (
            <button
              type="button"
              onClick={() => onSearchChange("")}
              aria-label="Borrar búsqueda"
              className="absolute right-2.5 top-1/2 -translate-y-1/2 rounded-md p-0.5 text-muted-foreground hover:text-foreground transition-colors">
              <X className="size-3.5" />
            </button>
          ) : null}
        </div>

        {/* Separador vertical sutil */}
        <div className="hidden h-5 w-px bg-border/60 sm:block" aria-hidden="true" />

        {/* Filtro de Prioridad */}
        <div className="shrink-0">
          <Select value={priorityFilter} onValueChange={onPriorityChange}>
            <SelectTrigger
              aria-label="Filtrar por prioridad"
              className={`h-9 rounded-xl border px-3 text-xs sm:text-sm font-medium gap-2 transition-all ${
                priorityFilter !== "all"
                  ? "border-amber-500/40 bg-amber-500/10 text-amber-600 dark:text-amber-400"
                  : "border-border/70 bg-background/50 text-muted-foreground hover:bg-accent/60 hover:text-foreground"
              }`}>
              <Flame className="size-3.5 shrink-0" />
              <span>
                {priorityFilter === "all"
                  ? "Todas las prioridades"
                  : `Prioridad: ${ticketPriorityLabels[priorityFilter as TicketPriority]}`}
              </span>
            </SelectTrigger>
            <SelectContent align="start" className="min-w-[190px]">
              <SelectItem value="all">
                <span className="font-medium">Todas las prioridades</span>
              </SelectItem>
              {TICKET_PRIORITIES.map((level) => {
                const Icon = PRIORITY_ICONS[level];
                const dotColor = PRIORITY_DOT_COLORS[level];
                return (
                  <SelectItem key={level} value={level}>
                    <div className="flex items-center gap-2">
                      <span className={`size-2 rounded-full ${dotColor}`} />
                      <Icon className="size-3.5" />
                      <span>{ticketPriorityLabels[level]}</span>
                    </div>
                  </SelectItem>
                );
              })}
            </SelectContent>
          </Select>
        </div>

        {/* Filtro de Técnico */}
        <div className="shrink-0">
          <Select value={employeeFilter} onValueChange={onEmployeeChange}>
            <SelectTrigger
              aria-label="Filtrar por técnico"
              className={`h-9 max-w-[240px] rounded-xl border px-3 text-xs sm:text-sm font-medium gap-2 transition-all ${
                employeeFilter !== "all"
                  ? "border-primary/40 bg-primary/10 text-primary"
                  : "border-border/70 bg-background/50 text-muted-foreground hover:bg-accent/60 hover:text-foreground"
              }`}>
              <UserRound className="size-3.5 shrink-0" />
              <span className="truncate">
                {employeeFilter === "all"
                  ? "Todos los técnicos"
                  : employeeFilter === "unassigned"
                    ? "Sin asignar"
                    : `Técnico: ${selectedEmployeeName || "Seleccionado"}`}
              </span>
            </SelectTrigger>
            <SelectContent align="start" className="max-h-72 min-w-[210px]">
              <SelectItem value="all">
                <span className="font-medium">Todos los técnicos</span>
              </SelectItem>
              <SelectItem value="unassigned">
                <div className="flex items-center gap-1.5 text-muted-foreground">
                  <UserX className="size-3.5" />
                  <span>Sin asignar</span>
                </div>
              </SelectItem>
              {employees.map((emp) => (
                <SelectItem key={emp.id} value={emp.id}>
                  <span>{emp.name}</span>
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>

        {/* Chips de filtros activos para limpiar individualmente */}
        {statusFilter !== DEFAULT_TICKET_STATUS_FILTER ? (
          <button
            type="button"
            onClick={() => onStatusChange(DEFAULT_TICKET_STATUS_FILTER)}
            className="inline-flex items-center gap-1 rounded-lg border border-blue-500/30 bg-blue-500/10 px-2 py-1 text-xs text-blue-600 hover:bg-blue-500/20 dark:text-blue-400 transition-colors"
            title="Restaurar filtro de agendados">
            <span>
              Estado:{" "}
              {STATUS_TABS.find((tab) => tab.id === statusFilter)?.label || statusFilter}
            </span>
            <X className="size-3" />
          </button>
        ) : null}

        {priorityFilter !== "all" ? (
          <button
            type="button"
            onClick={() => onPriorityChange("all")}
            className="inline-flex items-center gap-1 rounded-lg border border-amber-500/30 bg-amber-500/10 px-2 py-1 text-xs text-amber-600 hover:bg-amber-500/20 dark:text-amber-400 transition-colors"
            title="Quitar filtro de prioridad">
            <span>Prioridad: {ticketPriorityLabels[priorityFilter as TicketPriority]}</span>
            <X className="size-3" />
          </button>
        ) : null}

        {employeeFilter !== "all" ? (
          <button
            type="button"
            onClick={() => onEmployeeChange("all")}
            className="inline-flex items-center gap-1 rounded-lg border border-primary/30 bg-primary/10 px-2 py-1 text-xs text-primary hover:bg-primary/20 transition-colors"
            title="Quitar filtro de técnico">
            <span className="truncate max-w-[140px]">
              {employeeFilter === "unassigned"
                ? "Sin asignar"
                : selectedEmployeeName || "Técnico"}
            </span>
            <X className="size-3" />
          </button>
        ) : null}
      </div>
    </div>
  );
};
