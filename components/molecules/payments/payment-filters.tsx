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
import { DatePicker } from "@/components/atoms/DatePicker";

interface ClientFiltersProps {
  searchTerm: string;
  onSearchChange: (value: string) => void;
  statusFilter: string;
  setStatusFilter: React.Dispatch<React.SetStateAction<string>>;
  onClearFilters: () => void;
  payType: string;
  setPayType: React.Dispatch<React.SetStateAction<string>>;
  setBank: React.Dispatch<React.SetStateAction<string>>;
  bank: string;
  setSelectedDate: React.Dispatch<React.SetStateAction<Date | undefined>>;
  selectedDate: Date | undefined;
}

export function ClientFilters({
  searchTerm,
  onSearchChange,
  onClearFilters,
  statusFilter,
  setStatusFilter,
  payType,
  setPayType,
  bank,
  setBank,
  selectedDate,
  setSelectedDate,
}: ClientFiltersProps) {
  const hasActiveFilters = searchTerm;

  return (
    <div className="flex items-center gap-4">
      <div className="w-full flex gap-4 justify-between">
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
            <SelectValue placeholder="Filtrar estatus" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="EN_PROCESO">En proceso</SelectItem>
            <SelectItem value="RECHAZADO">Rechazado</SelectItem>
            <SelectItem value="APROBADO"> Aprobado </SelectItem>
          </SelectContent>
        </Select>

        <Select value={bank} onValueChange={setBank}>
          <SelectTrigger>
            <SelectValue placeholder="Filtrar Banco" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="Venezuela">Venezuela</SelectItem>
            <SelectItem value="Banplus"> Banplus </SelectItem>
            <SelectItem value="Bancamiga"> Bancamiga </SelectItem>
          </SelectContent>
        </Select>

        <DatePicker date={selectedDate} setDate={setSelectedDate} />

        <Select value={payType} onValueChange={setPayType}>
          <SelectTrigger>
            <SelectValue placeholder="Tipo de pago" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value={"true"}>Promesa de pago</SelectItem>
            <SelectItem value={"false"}>Pago completo</SelectItem>
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
