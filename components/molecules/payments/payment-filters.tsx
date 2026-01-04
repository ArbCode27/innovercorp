"use client";

import { Input } from "@/components/ui/input";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Button } from "@/components/ui/button";
import { Search, Filter, X } from "lucide-react";
import { zones, contractStatuses, equipmentStatuses } from "@/lib/mock-data";

interface ClientFiltersProps {
  searchTerm: string;
  onSearchChange: (value: string) => void;
  statusFilter: string;
  setStatusFilter: React.Dispatch<React.SetStateAction<string>>;
  onClearFilters: () => void;
}

export function ClientFilters({
  searchTerm,
  onSearchChange,
  onClearFilters,
  statusFilter,
  setStatusFilter,
}: ClientFiltersProps) {
  const hasActiveFilters = searchTerm;

  return (
    <div className="flex items-center gap-4">
      <div className="flex items-center space-x-2">
        <Filter className="w-4 text-muted-foreground" />
        <span className="text-sm font-medium text-foreground">Filtros</span>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
        <div className="relative">
          <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 w-4 h-4 text-muted-foreground" />
          <Input
            placeholder="Buscar cédula..."
            value={searchTerm}
            onChange={(e) => onSearchChange(e.target.value)}
            className="pl-10"
          />
        </div>

        <Select value={statusFilter} onValueChange={setStatusFilter}>
          <SelectTrigger>
            <SelectValue placeholder="Filtrar por zona" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="EN_PROCESO">En proceso</SelectItem>
            <SelectItem value="RECHAZADO">Rechazado</SelectItem>
            <SelectItem value="APROBADO"> Aprobado </SelectItem>
          </SelectContent>
        </Select>

        {/* <Select value={contractFilter} onValueChange={onContractFilterChange}>
          <SelectTrigger>
            <SelectValue placeholder="Estado del contrato" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">Todos los estados</SelectItem>
            {contractStatuses.map((status) => (
              <SelectItem key={status} value={status}>
                {status}
              </SelectItem>
            ))}
          </SelectContent>
        </Select> */}

        {/* <Select value={equipmentFilter} onValueChange={onEquipmentFilterChange}>
          <SelectTrigger>
            <SelectValue placeholder="Estado del equipo" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">Todos los estados</SelectItem>
            {equipmentStatuses.map((status) => (
              <SelectItem key={status} value={status}>
                {status}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>  */}
      </div>
    </div>
  );
}
