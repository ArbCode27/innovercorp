"use client";

import { Search, X } from "lucide-react";
import { Input } from "@/components/ui/input";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { CRM_MENU, CRM_MENU_ITEM, CRM_SURFACES } from "../../_lib/crm-theme";
import {
  CRM_KNOWN_PAYMENT_BANKS,
  CRM_PAYMENT_STATUSES,
  CRM_PAYMENT_STATUS_LABELS,
  type CrmPaymentStatus,
} from "../../_lib/payments";
import { CrmButton } from "../shared/crm-button";

interface PaymentsFiltersProps {
  searchTerm: string;
  period: "today" | "week" | "month";
  status: CrmPaymentStatus | "all";
  bank: string;
  banks: string[];
  onSearchChange: (value: string) => void;
  onPeriodChange: (value: "today" | "week" | "month") => void;
  onStatusChange: (value: CrmPaymentStatus | "all") => void;
  onBankChange: (value: string) => void;
  onClearFilters: () => void;
}

const PERIOD_LABELS: Record<"today" | "week" | "month", string> = {
  today: "Pagos de hoy",
  week: "Última semana",
  month: "Este mes",
};

const selectClass = `w-full ${CRM_SURFACES.border} ${CRM_SURFACES.input} ${CRM_SURFACES.textPrimary}`;

export const PaymentsFilters = ({
  searchTerm,
  period,
  status,
  bank,
  banks,
  onSearchChange,
  onPeriodChange,
  onStatusChange,
  onBankChange,
  onClearFilters,
}: PaymentsFiltersProps) => {
  const bankOptions = Array.from(
    new Set([...CRM_KNOWN_PAYMENT_BANKS, ...banks]),
  );
  const hasActiveFilters = Boolean(
    searchTerm || period !== "today" || status !== "all" || bank !== "all",
  );

  const handleStatusChange = (value: string) => {
    if (value === "all") {
      onStatusChange("all");
      return;
    }
    if (CRM_PAYMENT_STATUSES.includes(value as CrmPaymentStatus)) {
      onStatusChange(value as CrmPaymentStatus);
    }
  };

  const handlePeriodChange = (value: string) => {
    if (value === "today" || value === "week" || value === "month") {
      onPeriodChange(value);
    }
  };

  return (
    <div
      className={`rounded-xl border p-4 ${CRM_SURFACES.border} ${CRM_SURFACES.elevated}`}>
      <div className="grid gap-3 md:grid-cols-2 xl:grid-cols-5">
        <div className="xl:col-span-2">
          <label htmlFor="crm-payments-search" className="sr-only">
            Buscar por cédula o nombre
          </label>
          <div className="relative">
            <Search
              className="pointer-events-none absolute left-3 top-1/2 size-4 -translate-y-1/2 text-slate-500"
              aria-hidden="true"
            />
            <Input
              id="crm-payments-search"
              value={searchTerm}
              onChange={(event) => onSearchChange(event.target.value)}
              placeholder="Buscar cédula o nombre..."
              className={`pl-9 ${CRM_SURFACES.border} ${CRM_SURFACES.input} ${CRM_SURFACES.textPrimary} ${CRM_SURFACES.placeholder}`}
            />
          </div>
        </div>

        <Select value={period} onValueChange={handlePeriodChange}>
          <SelectTrigger className={selectClass} aria-label="Filtrar por período">
            <SelectValue placeholder="Período" />
          </SelectTrigger>
          <SelectContent className={CRM_MENU}>
            {Object.entries(PERIOD_LABELS).map(([key, label]) => (
              <SelectItem key={key} value={key} className={CRM_MENU_ITEM}>
                {label}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>

        <Select value={status} onValueChange={handleStatusChange}>
          <SelectTrigger className={selectClass} aria-label="Filtrar por estado">
            <SelectValue placeholder="Estado" />
          </SelectTrigger>
          <SelectContent className={CRM_MENU}>
            <SelectItem value="all" className={CRM_MENU_ITEM}>
              Todos los estados
            </SelectItem>
            {CRM_PAYMENT_STATUSES.map((item) => (
              <SelectItem key={item} value={item} className={CRM_MENU_ITEM}>
                {CRM_PAYMENT_STATUS_LABELS[item]}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>

        <Select value={bank} onValueChange={onBankChange}>
          <SelectTrigger className={selectClass} aria-label="Filtrar por banco">
            <SelectValue placeholder="Banco" />
          </SelectTrigger>
          <SelectContent className={CRM_MENU}>
            <SelectItem value="all" className={CRM_MENU_ITEM}>
              Todos los bancos
            </SelectItem>
            {bankOptions.map((item) => (
              <SelectItem key={item} value={item} className={CRM_MENU_ITEM}>
                {item}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
      </div>

      {hasActiveFilters ? (
        <div className="mt-3 flex justify-end">
          <CrmButton
            type="button"
            variant="ghost"
            size="sm"
            onClick={onClearFilters}>
            <X className="mr-1 size-4" aria-hidden="true" />
            Limpiar filtros
          </CrmButton>
        </div>
      ) : null}
    </div>
  );
};
