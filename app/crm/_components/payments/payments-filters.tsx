"use client";

import { useMemo, useState } from "react";
import { format } from "date-fns";
import { es } from "date-fns/locale";
import type { DateRange } from "react-day-picker";
import {
  CalendarIcon,
  CheckCircle2,
  ChevronDown,
  ChevronLeft,
  ChevronRight,
  Receipt,
  Search,
  X,
} from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Calendar } from "@/components/ui/calendar";
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from "@/components/ui/popover";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { CRM_SURFACES } from "../../_lib/crm-theme";
import {
  CRM_KNOWN_PAYMENT_BANKS,
  CRM_PAYMENT_STATUSES,
  CRM_PAYMENT_STATUS_LABELS,
  type CrmPaymentStatus,
  type PaymentDateType,
} from "../../_lib/payments";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";

export type { PaymentDateType };

export type PaymentsDateRange = {
  from: string | null;
  to: string | null;
};

interface PaymentsFiltersProps {
  searchTerm: string;
  dateRange: PaymentsDateRange;
  dateType: PaymentDateType;
  status: CrmPaymentStatus | "all";
  bank: string;
  banks: string[];
  onSearchChange: (value: string) => void;
  onDateRangeChange: (value: PaymentsDateRange) => void;
  onDateTypeChange: (value: PaymentDateType) => void;
  onStatusChange: (value: CrmPaymentStatus | "all") => void;
  onBankChange: (value: string) => void;
  onClearFilters: () => void;
}

const selectClass = `w-full h-10 ${CRM_SURFACES.border}  ${CRM_SURFACES.textPrimary}`;

const parseIsoDateLocal = (value: string | null): Date | undefined => {
  if (!value || !/^\d{4}-\d{2}-\d{2}$/.test(value)) return undefined;
  const [year, month, day] = value.split("-").map(Number);
  if (!year || !month || !day) return undefined;
  return new Date(year, month - 1, day);
};

const toIsoDateLocal = (date: Date) =>
  format(date, "yyyy-MM-dd");

const formatRangeLabel = (range: PaymentsDateRange) => {
  const from = parseIsoDateLocal(range.from);
  const to = parseIsoDateLocal(range.to);

  if (from && to) {
    if (range.from === range.to) {
      return format(from, "d MMM yyyy", { locale: es });
    }
    return `${format(from, "d MMM yyyy", { locale: es })} – ${format(to, "d MMM yyyy", { locale: es })}`;
  }

  if (from) {
    return `Desde ${format(from, "d MMM yyyy", { locale: es })}`;
  }

  return "Seleccionar fechas";
};

export const PaymentsFilters = ({
  searchTerm,
  dateRange,
  dateType,
  status,
  bank,
  banks,
  onSearchChange,
  onDateRangeChange,
  onDateTypeChange,
  onStatusChange,
  onBankChange,
  onClearFilters,
}: PaymentsFiltersProps) => {
  const [calendarOpen, setCalendarOpen] = useState(false);

  const selectedRange = useMemo<DateRange | undefined>(() => {
    const from = parseIsoDateLocal(dateRange.from);
    const to = parseIsoDateLocal(dateRange.to);
    if (!from && !to) return undefined;
    return { from, to: to || from };
  }, [dateRange.from, dateRange.to]);

  const bankOptions = Array.from(
    new Set([...CRM_KNOWN_PAYMENT_BANKS, ...banks]),
  );

  const hasActiveFilters = Boolean(
    searchTerm ||
      dateRange.from ||
      dateRange.to ||
      dateType !== "payment" ||
      status !== "EN_PROCESO" ||
      bank !== "all",
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

  const handleCalendarSelect = (range: DateRange | undefined) => {
    if (!range?.from) {
      onDateRangeChange({ from: null, to: null });
      return;
    }

    const from = toIsoDateLocal(range.from);
    const to = range.to ? toIsoDateLocal(range.to) : from;
    onDateRangeChange({ from, to });

    if (range.to) {
      setCalendarOpen(false);
    }
  };

  const handleClearDates = () => {
    onDateRangeChange({ from: null, to: null });
    setCalendarOpen(false);
  };

  const handleDateTypeSelect = (nextType: PaymentDateType) => {
    onDateTypeChange(nextType);
  };

  const handleSelectPreset = (
    preset: "today" | "yesterday" | "last7" | "thisMonth",
  ) => {
    const today = new Date();
    if (preset === "today") {
      const iso = toIsoDateLocal(today);
      onDateRangeChange({ from: iso, to: iso });
    } else if (preset === "yesterday") {
      const yesterday = new Date(today);
      yesterday.setDate(yesterday.getDate() - 1);
      const iso = toIsoDateLocal(yesterday);
      onDateRangeChange({ from: iso, to: iso });
    } else if (preset === "last7") {
      const start = new Date(today);
      start.setDate(start.getDate() - 6);
      onDateRangeChange({
        from: toIsoDateLocal(start),
        to: toIsoDateLocal(today),
      });
    } else if (preset === "thisMonth") {
      const firstDay = new Date(today.getFullYear(), today.getMonth(), 1);
      onDateRangeChange({
        from: toIsoDateLocal(firstDay),
        to: toIsoDateLocal(today),
      });
    }
  };

  return (
    <div className={`rounded-2xl p-4 ${CRM_SURFACES.elevated}`}>
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
              className={`h-10 pl-9 ${searchTerm ? "pr-8" : ""} ${CRM_SURFACES.border}  ${CRM_SURFACES.textPrimary} ${CRM_SURFACES.placeholder}`}
            />
            {searchTerm ? (
              <button
                type="button"
                onClick={() => onSearchChange("")}
                className="absolute right-2.5 top-1/2 -translate-y-1/2 rounded-full p-0.5 text-muted-foreground hover:text-foreground focus:outline-hidden cursor-pointer"
                aria-label="Limpiar búsqueda">
                <X className="size-4" aria-hidden="true" />
              </button>
            ) : null}
          </div>
        </div>

        <Popover open={calendarOpen} onOpenChange={setCalendarOpen}>
          <PopoverTrigger asChild>
            <Button
              type="button"
              variant="secondary"
              className={cn(
                "h-10 w-full cursor-pointer justify-between gap-2 px-3 font-normal transition-all",
                CRM_SURFACES.border,
                CRM_SURFACES.textPrimary,
                dateType === "approval"
                  ? "border-emerald-500/40 bg-emerald-500/5 hover:bg-emerald-500/10 focus-visible:ring-emerald-500/30"
                  : "hover:bg-accent/60",
              )}
              aria-label={`Filtrar por ${dateType === "approval" ? "fecha de aprobación" : "fecha de registro"}`}
              title={
                searchTerm.trim()
                  ? "Búsqueda activa: se buscan clientes en cualquier fecha"
                  : undefined
              }>
              <div className="flex min-w-0 items-center gap-2">
                {dateType === "approval" ? (
                  <div className="flex size-6 shrink-0 items-center justify-center rounded-md bg-emerald-500/15 text-emerald-600 dark:text-emerald-400">
                    <CheckCircle2 className="size-3.5" aria-hidden="true" />
                  </div>
                ) : (
                  <div className="flex size-6 shrink-0 items-center justify-center rounded-md bg-primary/10 text-primary">
                    <Receipt className="size-3.5" aria-hidden="true" />
                  </div>
                )}
                <div className="flex min-w-0 flex-col text-left">
                  <span className="text-[10px] font-semibold uppercase tracking-wider text-muted-foreground leading-none">
                    {dateType === "approval" ? "F. Aprobación" : "F. Registro"}
                  </span>
                  <span className="truncate text-xs font-medium text-foreground leading-tight mt-0.5">
                    {searchTerm.trim()
                      ? "Todas las fechas (búsqueda)"
                      : formatRangeLabel(dateRange)}
                  </span>
                </div>
              </div>
              <ChevronDown
                className="size-3.5 shrink-0 text-muted-foreground/70"
                aria-hidden="true"
              />
            </Button>
          </PopoverTrigger>
          <PopoverContent
            align="start"
            className="w-auto overflow-hidden rounded-2xl p-0 shadow-xl border-border/80"
            sideOffset={8}>
            {/* SEGMENTED CONTROL: Select Date Type */}
            <div className="border-b border-border/60 bg-muted/30 p-3">
              <div className="mb-2 flex items-center justify-between">
                <span className="text-xs font-semibold tracking-tight text-foreground">
                  Criterio de fecha
                </span>
                <Badge
                  variant="outline"
                  className={cn(
                    "px-2 py-0.5 text-[10px] font-normal transition-colors",
                    dateType === "approval"
                      ? "border-emerald-500/40 bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 font-medium"
                      : "border-primary/30 bg-primary/10 text-primary font-medium",
                  )}>
                  {dateType === "approval"
                    ? "Aprobados en el rango"
                    : "Ingresados en el rango"}
                </Badge>
              </div>

              <div
                role="radiogroup"
                aria-label="Seleccionar criterio de fecha"
                className="grid grid-cols-2 gap-1 rounded-xl bg-muted/80 p-1">
                <button
                  type="button"
                  role="radio"
                  aria-checked={dateType === "payment"}
                  onClick={() => handleDateTypeSelect("payment")}
                  className={cn(
                    "flex items-center justify-center gap-1.5 rounded-lg py-1.5 px-2.5 text-xs font-medium transition-all cursor-pointer focus-visible:outline-hidden focus-visible:ring-2 focus-visible:ring-primary",
                    dateType === "payment"
                      ? "bg-background text-foreground shadow-xs font-semibold"
                      : "text-muted-foreground hover:bg-background/40 hover:text-foreground",
                  )}>
                  <Receipt
                    className="size-3.5 shrink-0 text-primary"
                    aria-hidden="true"
                  />
                  <span>F. de Registro</span>
                </button>

                <button
                  type="button"
                  role="radio"
                  aria-checked={dateType === "approval"}
                  onClick={() => handleDateTypeSelect("approval")}
                  className={cn(
                    "flex items-center justify-center gap-1.5 rounded-lg py-1.5 px-2.5 text-xs font-medium transition-all cursor-pointer focus-visible:outline-hidden focus-visible:ring-2 focus-visible:ring-emerald-500",
                    dateType === "approval"
                      ? "bg-emerald-600 text-white shadow-xs font-semibold dark:bg-emerald-600"
                      : "text-muted-foreground hover:bg-background/40 hover:text-foreground",
                  )}>
                  <CheckCircle2
                    className="size-3.5 shrink-0"
                    aria-hidden="true"
                  />
                  <span>F. de Aprobación</span>
                </button>
              </div>
            </div>

            {/* PRESETS: Quick date range shortcuts */}
            <div className="flex items-center justify-between border-b border-border/50 bg-background/50 px-3 py-1.5 text-[11px]">
              <span className="text-muted-foreground">Accesos rápidos:</span>
              <div className="flex items-center gap-1">
                <button
                  type="button"
                  onClick={() => handleSelectPreset("today")}
                  className="rounded-md px-2 py-0.5 font-medium text-muted-foreground hover:bg-muted hover:text-foreground cursor-pointer transition-colors">
                  Hoy
                </button>
                <button
                  type="button"
                  onClick={() => handleSelectPreset("yesterday")}
                  className="rounded-md px-2 py-0.5 font-medium text-muted-foreground hover:bg-muted hover:text-foreground cursor-pointer transition-colors">
                  Ayer
                </button>
                <button
                  type="button"
                  onClick={() => handleSelectPreset("last7")}
                  className="rounded-md px-2 py-0.5 font-medium text-muted-foreground hover:bg-muted hover:text-foreground cursor-pointer transition-colors">
                  7 días
                </button>
                <button
                  type="button"
                  onClick={() => handleSelectPreset("thisMonth")}
                  className="rounded-md px-2 py-0.5 font-medium text-muted-foreground hover:bg-muted hover:text-foreground cursor-pointer transition-colors">
                  Este mes
                </button>
              </div>
            </div>

            {/* CALENDAR */}
            <Calendar
              mode="range"
              numberOfMonths={1}
              defaultMonth={selectedRange?.from}
              selected={selectedRange}
              onSelect={handleCalendarSelect}
              locale={es}
              disabled={{ after: new Date() }}
            />

            {/* FOOTER */}
            <div
              className={cn(
                "flex items-center justify-between gap-2 border-t px-3 py-2",
                CRM_SURFACES.border,
              )}>
              <p className={cn("text-xs", CRM_SURFACES.textMuted)}>
                {dateType === "approval"
                  ? "Rango de aprobación"
                  : "Rango del comprobante"}
              </p>
              <div className="flex items-center gap-1.5">
                <Button
                  type="button"
                  variant="ghost"
                  size="sm"
                  className="h-7 px-2.5 text-xs cursor-pointer text-muted-foreground hover:text-foreground"
                  disabled={!dateRange.from && !dateRange.to}
                  onClick={handleClearDates}>
                  Limpiar
                </Button>
                <Button
                  type="button"
                  size="sm"
                  className="h-7 px-3 text-xs cursor-pointer"
                  onClick={() => setCalendarOpen(false)}>
                  Listo
                </Button>
              </div>
            </div>
          </PopoverContent>
        </Popover>

        <Select value={status} onValueChange={handleStatusChange}>
          <SelectTrigger className={selectClass} aria-label="Filtrar por estado">
            <SelectValue placeholder="Estado" />
          </SelectTrigger>
          <SelectContent >
            <SelectItem value="all" className="cursor-pointer">
              Todos los estados
            </SelectItem>
            {CRM_PAYMENT_STATUSES.map((item) => (
              <SelectItem key={item} value={item} className="cursor-pointer">
                {CRM_PAYMENT_STATUS_LABELS[item]}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>

        <Select value={bank} onValueChange={onBankChange}>
          <SelectTrigger className={selectClass} aria-label="Filtrar por banco">
            <SelectValue placeholder="Banco" />
          </SelectTrigger>
          <SelectContent >
            <SelectItem value="all" className="cursor-pointer">
              Todos los bancos
            </SelectItem>
            {bankOptions.map((item) => (
              <SelectItem key={item} value={item} className="cursor-pointer">
                {item}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
      </div>

      {hasActiveFilters ? (
        <div className="mt-3 flex justify-end">
          <Button
            type="button"
            variant="ghost"
            size="sm"
            onClick={onClearFilters}>
            <X className="mr-1 size-4" aria-hidden="true" />
            Limpiar filtros
          </Button>
        </div>
      ) : null}
    </div>
  );
};

interface PaymentsPaginationProps {
  page: number;
  pageSize: number;
  total: number;
  isLoading?: boolean;
  onPageChange: (page: number) => void;
}

export const PaymentsPagination = ({
  page,
  pageSize,
  total,
  isLoading = false,
  onPageChange,
}: PaymentsPaginationProps) => {
  const totalPages = Math.max(1, Math.ceil(total / pageSize));
  const currentPage = Math.min(Math.max(page, 1), totalPages);
  const from = total === 0 ? 0 : (currentPage - 1) * pageSize + 1;
  const to = Math.min(currentPage * pageSize, total);

  if (total === 0) return null;

  return (
    <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
      <p className={`text-xs ${CRM_SURFACES.textMuted}`}>
        Mostrando {from}–{to} de {total}
      </p>
      <div className="flex items-center gap-2">
        <Button
          type="button"
          variant="secondary"
          size="sm"
          disabled={isLoading || currentPage <= 1}
          className="cursor-pointer"
          onClick={() => onPageChange(currentPage - 1)}
          aria-label="Página anterior">
          <ChevronLeft className="size-4" aria-hidden="true" />
          Anterior
        </Button>
        <span className={`min-w-24 text-center text-xs ${CRM_SURFACES.textSecondary}`}>
          Página {currentPage} de {totalPages}
        </span>
        <Button
          type="button"
          variant="secondary"
          size="sm"
          disabled={isLoading || currentPage >= totalPages}
          className="cursor-pointer"
          onClick={() => onPageChange(currentPage + 1)}
          aria-label="Página siguiente">
          Siguiente
          <ChevronRight className="size-4" aria-hidden="true" />
        </Button>
      </div>
    </div>
  );
};
