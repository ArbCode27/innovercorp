"use client";

import { FilterX, Search } from "lucide-react";
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
import { TICKET_PRIORITIES, ticketPriorityLabels } from "../../_lib/wispro-caso-schema";
import type { WisproEmployee } from "@/lib/wispro-types";

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
  onReset,
}: TicketFiltersProps) => {
  const hasActiveFilters =
    Boolean(searchQuery.trim()) ||
    statusFilter !== "all" ||
    priorityFilter !== "all" ||
    employeeFilter !== "all";

  return (
    <div className={`space-y-3 rounded-2xl p-3 md:p-4 ${CRM_SURFACES.elevated}`}>
      <div className="grid gap-2.5 sm:grid-cols-2 lg:grid-cols-4">
        <div className="relative sm:col-span-2 lg:col-span-1">
          <Search
            className="pointer-events-none absolute left-3 top-1/2 size-4 -translate-y-1/2 text-slate-400"
            aria-hidden="true"
          />
          <Input
            value={searchQuery}
            onChange={(e) => onSearchChange(e.target.value)}
            placeholder="Buscar por cliente, #, causa..."
            aria-label="Buscar tickets"
            className={`pl-9 ${CRM_SURFACES.border} ${CRM_SURFACES.textPrimary} ${CRM_SURFACES.placeholder}`}
          />
        </div>

        <div>
          <Select value={statusFilter} onValueChange={onStatusChange}>
            <SelectTrigger aria-label="Filtrar por estado">
              <SelectValue placeholder="Estado" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">Todos los estados</SelectItem>
              <SelectItem value="open">Abierto</SelectItem>
              <SelectItem value="scheduled">Agendado</SelectItem>
              <SelectItem value="done">Cerrado</SelectItem>
              <SelectItem value="cancelled">Cancelado</SelectItem>
            </SelectContent>
          </Select>
        </div>

        <div>
          <Select value={priorityFilter} onValueChange={onPriorityChange}>
            <SelectTrigger aria-label="Filtrar por prioridad">
              <SelectValue placeholder="Prioridad" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">Todas las prioridades</SelectItem>
              {TICKET_PRIORITIES.map((level) => (
                <SelectItem key={level} value={level}>
                  Prioridad {ticketPriorityLabels[level]}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>

        <div>
          <Select value={employeeFilter} onValueChange={onEmployeeChange}>
            <SelectTrigger aria-label="Filtrar por técnico">
              <SelectValue placeholder="Técnico" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">Todos los técnicos</SelectItem>
              <SelectItem value="unassigned">Sin asignar</SelectItem>
              {employees.map((emp) => (
                <SelectItem key={emp.id} value={emp.id}>
                  {emp.name}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>
      </div>

      <div className="flex flex-wrap items-center justify-between gap-2 pt-1 text-xs">
        <p className={CRM_SURFACES.textMuted}>
          Mostrando{" "}
          <span className={`font-semibold ${CRM_SURFACES.textPrimary}`}>
            {filteredCount}
          </span>{" "}
          de{" "}
          <span className={`font-semibold ${CRM_SURFACES.textPrimary}`}>
            {totalCount}
          </span>{" "}
          tickets
        </p>

        {hasActiveFilters ? (
          <Button
            type="button"
            variant="ghost"
            size="sm"
            onClick={onReset}
            className="h-7 gap-1 px-2 text-xs text-slate-500 hover:text-slate-800 dark:hover:text-slate-200">
            <FilterX className="size-3.5" />
            Limpiar filtros
          </Button>
        ) : null}
      </div>
    </div>
  );
};
