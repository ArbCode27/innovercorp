"use client";

import { useEffect, useMemo, useState } from "react";
import {
  Building2,
  Calendar,
  Check,
  Download,
  FileSpreadsheet,
  Filter,
  Landmark,
  Loader2,
  Wallet,
} from "lucide-react";
import { toast } from "sonner";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Checkbox } from "@/components/ui/checkbox";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { cn } from "@/lib/utils";
import {
  CRM_KNOWN_PAYMENT_BANKS,
  CRM_PAYMENT_STATUS_LABELS,
  CRM_PAYMENT_STATUSES,
  formatPaymentAmount,
  normalizeReceptorBank,
  type CrmPayment,
  type CrmPaymentBankStat,
  type CrmPaymentStatus,
} from "../../_lib/payments";
import {
  buildExportFileName,
  downloadExportFile,
  generatePaymentsCsv,
  generatePaymentsExcelXml,
} from "../../_lib/payments-export";

interface PaymentsExportDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  availableBanks: string[];
  currentBankFilter: string;
  currentDateRange: { from: string; to: string };
  currentStatus: CrmPaymentStatus | "all";
  bankStats: CrmPaymentBankStat[];
}

const getBankCardMeta = (bank: string) => {
  const normalized = bank.toLowerCase();

  if (normalized.includes("venezuela") || normalized.includes("bdv")) {
    return {
      displayName: "Banco de Venezuela",
      subName: "BDV · Receptor",
      icon: Building2,
      accentBorder: "border-red-500/40",
      accentBg: "bg-red-500/5",
      iconBg: "bg-red-500/10 text-red-600 dark:text-red-400 border-red-500/20",
    };
  }

  if (normalized.includes("bancamiga")) {
    return {
      displayName: "Bancamiga",
      subName: "Cuenta Receptora",
      icon: Landmark,
      accentBorder: "border-emerald-500/40",
      accentBg: "bg-emerald-500/5",
      iconBg:
        "bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 border-emerald-500/20",
    };
  }

  if (normalized.includes("banplus")) {
    return {
      displayName: "Banplus",
      subName: "Cuenta Receptora",
      icon: Wallet,
      accentBorder: "border-blue-500/40",
      accentBg: "bg-blue-500/5",
      iconBg: "bg-blue-500/10 text-blue-600 dark:text-blue-400 border-blue-500/20",
    };
  }

  return {
    displayName: bank,
    subName: "Cuenta Registrada",
    icon: Landmark,
    accentBorder: "border-purple-500/40",
    accentBg: "bg-purple-500/5",
    iconBg:
      "bg-purple-500/10 text-purple-600 dark:text-purple-400 border-purple-500/20",
  };
};

const toCaracasIsoDate = (date: Date) =>
  new Intl.DateTimeFormat("en-CA", {
    timeZone: "America/Caracas",
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  }).format(date);

export const PaymentsExportDialog = ({
  open,
  onOpenChange,
  availableBanks,
  currentBankFilter,
  currentDateRange,
  currentStatus,
  bankStats,
}: PaymentsExportDialogProps) => {
  const allBanksList = useMemo(() => {
    return Array.from(
      new Set([
        ...CRM_KNOWN_PAYMENT_BANKS,
        ...availableBanks.map((b) => normalizeReceptorBank(b) || b),
      ]),
    ).filter(Boolean);
  }, [availableBanks]);

  const [selectedBanks, setSelectedBanks] = useState<string[]>([]);
  const [dateRange, setDateRange] = useState<{ from: string; to: string }>(
    currentDateRange,
  );
  const [statusFilter, setStatusFilter] = useState<CrmPaymentStatus | "all">(
    currentStatus,
  );
  const [isExporting, setIsExporting] = useState(false);
  const [exportFormat, setExportFormat] = useState<"xls" | "csv">("xls");

  // Sync initial state when dialog opens
  useEffect(() => {
    if (open) {
      if (currentBankFilter && currentBankFilter !== "all") {
        setSelectedBanks([currentBankFilter]);
      } else {
        setSelectedBanks([...allBanksList]);
      }
      setDateRange(currentDateRange);
      setStatusFilter(currentStatus);
      setIsExporting(false);
    }
  }, [open, currentBankFilter, currentDateRange, currentStatus, allBanksList]);

  const handleToggleBank = (bank: string) => {
    setSelectedBanks((prev) =>
      prev.includes(bank) ? prev.filter((b) => b !== bank) : [...prev, bank],
    );
  };

  const handleSelectAllBanks = () => {
    setSelectedBanks([...allBanksList]);
  };

  const handleClearBanks = () => {
    setSelectedBanks([]);
  };

  const handleSetQuickDate = (mode: "today" | "last7" | "thisMonth") => {
    const today = new Date();
    const todayIso = toCaracasIsoDate(today);

    if (mode === "today") {
      setDateRange({ from: todayIso, to: todayIso });
      return;
    }

    if (mode === "last7") {
      const past = new Date(today);
      past.setDate(today.getDate() - 7);
      setDateRange({ from: toCaracasIsoDate(past), to: todayIso });
      return;
    }

    if (mode === "thisMonth") {
      const firstDay = new Date(today.getFullYear(), today.getMonth(), 1);
      setDateRange({ from: toCaracasIsoDate(firstDay), to: todayIso });
    }
  };

  // Estimate stats based on selected banks and bankStats
  const selectionSummary = useMemo(() => {
    const filteredStats = bankStats.filter((s) => selectedBanks.includes(s.bank));
    const count = filteredStats.reduce((acc, s) => acc + s.totalPayments, 0);
    const amount = filteredStats.reduce((acc, s) => acc + s.totalAmount, 0);
    return { count, amount };
  }, [bankStats, selectedBanks]);

  const handleExecuteExport = async (format: "xls" | "csv") => {
    if (selectedBanks.length === 0) {
      toast.error("Selecciona al menos una cuenta bancaria para exportar");
      return;
    }

    setIsExporting(true);
    setExportFormat(format);

    try {
      // Fetch matching payments for export with limit 2000
      const params = new URLSearchParams();
      if (dateRange.from) params.set("from", dateRange.from);
      if (dateRange.to) params.set("to", dateRange.to);
      if (statusFilter !== "all") params.set("status", statusFilter);
      params.set("limit", "2000");
      params.set("offset", "0");

      // If exactly 1 bank selected, query with that bank filter directly
      if (selectedBanks.length === 1 && selectedBanks[0]) {
        params.set("bank", selectedBanks[0]);
      }

      const response = await fetch(`/api/crm/payments?${params.toString()}`);
      const payload = (await response.json()) as {
        ok?: boolean;
        error?: string;
        payments?: CrmPayment[];
      };

      if (!response.ok || !payload.ok) {
        throw new Error(payload.error || "No se pudieron obtener los pagos");
      }

      const allFetched = payload.payments || [];

      // Filter client-side by selected banks if more than one bank is selected
      const normalizedSelectedSet = new Set(
        selectedBanks.map((b) => b.toLowerCase()),
      );

      const paymentsToExport =
        selectedBanks.length === allBanksList.length
          ? allFetched
          : allFetched.filter((p) => {
              const bankName = normalizeReceptorBank(p.bank) || p.bank || "";
              return normalizedSelectedSet.has(bankName.toLowerCase());
            });

      if (paymentsToExport.length === 0) {
        toast.info(
          "No hay pagos registrados para los bancos y fechas seleccionadas",
        );
      }

      const fileName = buildExportFileName(selectedBanks, dateRange, format);

      if (format === "xls") {
        const xmlContent = generatePaymentsExcelXml({
          payments: paymentsToExport,
          selectedBanks,
          dateRange,
          statusFilter:
            statusFilter !== "all"
              ? CRM_PAYMENT_STATUS_LABELS[statusFilter] || statusFilter
              : undefined,
        });
        downloadExportFile(xmlContent, fileName, "application/vnd.ms-excel");
      } else {
        const csvContent = generatePaymentsCsv({
          payments: paymentsToExport,
          selectedBanks,
          dateRange,
          statusFilter:
            statusFilter !== "all"
              ? CRM_PAYMENT_STATUS_LABELS[statusFilter] || statusFilter
              : undefined,
        });
        downloadExportFile(csvContent, fileName, "text/csv");
      }

      toast.success(`Archivo ${fileName} generado y descargado exitosamente`);
      onOpenChange(false);
    } catch (exportError) {
      console.error("[PAYMENTS_EXPORT] failed", exportError);
      toast.error(
        exportError instanceof Error
          ? exportError.message
          : "Error al generar el archivo de exportación",
      );
    } finally {
      setIsExporting(false);
    }
  };

  const isAllSelected = selectedBanks.length === allBanksList.length;

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-2xl sm:rounded-2xl">
        <DialogHeader className="space-y-1.5 pb-2">
          <div className="flex items-center gap-2">
            <div className="flex size-9 items-center justify-center rounded-xl bg-emerald-500/10 text-emerald-600 dark:text-emerald-400">
              <FileSpreadsheet className="size-5" aria-hidden="true" />
            </div>
            <div>
              <DialogTitle className="text-lg font-semibold tracking-tight text-foreground">
                Exportar Pagos a Excel
              </DialogTitle>
              <DialogDescription className="text-xs text-muted-foreground">
                Genera una tabla en Excel estructurada, con columnas claras y el
                total consolidado de pagos recibidos.
              </DialogDescription>
            </div>
          </div>
        </DialogHeader>

        <div className="space-y-4 py-2">
          {/* BANCO SELECTION HEADER & ACTION BUTTONS */}
          <div className="space-y-2">
            <div className="flex items-center justify-between">
              <Label className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">
                1. Selecciona las Cuentas / Bancos Receptores
              </Label>
              <div className="flex items-center gap-2">
                <Button
                  type="button"
                  variant="ghost"
                  size="sm"
                  onClick={handleSelectAllBanks}
                  className="h-7 text-xs text-primary hover:text-primary/80">
                  Seleccionar todos
                </Button>
                <span className="text-border">|</span>
                <Button
                  type="button"
                  variant="ghost"
                  size="sm"
                  onClick={handleClearBanks}
                  className="h-7 text-xs text-muted-foreground hover:text-foreground">
                  Limpiar
                </Button>
              </div>
            </div>

            {/* BANK MULTI-SELECT CARDS */}
            <div className="grid gap-2.5 sm:grid-cols-3">
              {allBanksList.map((bank) => {
                const isSelected = selectedBanks.includes(bank);
                const meta = getBankCardMeta(bank);
                const Icon = meta.icon;
                const stat = bankStats.find((s) => s.bank === bank);

                return (
                  <Card
                    key={bank}
                    role="button"
                    tabIndex={0}
                    onClick={() => handleToggleBank(bank)}
                    onKeyDown={(e) => {
                      if (e.key === "Enter" || e.key === " ") {
                        e.preventDefault();
                        handleToggleBank(bank);
                      }
                    }}
                    className={cn(
                      "group relative cursor-pointer border py-3 transition-all duration-150 select-none",
                      isSelected
                        ? cn(meta.accentBorder, meta.accentBg, "ring-1 ring-primary/40")
                        : "border-border/60 hover:border-border hover:bg-accent/40 opacity-70 hover:opacity-100",
                    )}>
                    <CardContent className="px-3">
                      <div className="flex items-start justify-between gap-1.5">
                        <div className="flex items-center gap-2">
                          <div
                            className={cn(
                              "flex size-7 shrink-0 items-center justify-center rounded-lg border",
                              meta.iconBg,
                            )}>
                            <Icon className="size-3.5" aria-hidden="true" />
                          </div>
                          <div>
                            <p className="text-xs font-semibold leading-tight text-foreground">
                              {meta.displayName}
                            </p>
                            <p className="text-[10px] text-muted-foreground">
                              {meta.subName}
                            </p>
                          </div>
                        </div>

                        <Checkbox
                          checked={isSelected}
                          onCheckedChange={() => handleToggleBank(bank)}
                          aria-label={`Seleccionar ${meta.displayName}`}
                          className="size-4 pointer-events-none"
                        />
                      </div>

                      {stat ? (
                        <div className="mt-2.5 flex items-baseline justify-between border-t border-border/40 pt-1.5 text-[11px]">
                          <span className="text-muted-foreground">
                            {stat.totalPayments}{" "}
                            {stat.totalPayments === 1 ? "pago" : "pagos"}
                          </span>
                          <span className="font-semibold text-foreground">
                            {formatPaymentAmount(stat.totalAmount)}
                          </span>
                        </div>
                      ) : null}
                    </CardContent>
                  </Card>
                );
              })}
            </div>
          </div>

          {/* DATE RANGE AND STATUS FILTERS */}
          <div className="rounded-xl border border-border/60 bg-muted/20 p-3 space-y-3">
            <div className="flex items-center justify-between">
              <span className="text-xs font-semibold uppercase tracking-wider text-muted-foreground flex items-center gap-1.5">
                <Filter className="size-3.5" aria-hidden="true" />
                2. Rango de Fechas y Estado
              </span>

              {/* Quick Date Shortcuts */}
              <div className="flex items-center gap-1">
                <Button
                  type="button"
                  variant="outline"
                  size="sm"
                  onClick={() => handleSetQuickDate("today")}
                  className="h-6 px-2 text-[11px]">
                  Hoy
                </Button>
                <Button
                  type="button"
                  variant="outline"
                  size="sm"
                  onClick={() => handleSetQuickDate("last7")}
                  className="h-6 px-2 text-[11px]">
                  Últimos 7 días
                </Button>
                <Button
                  type="button"
                  variant="outline"
                  size="sm"
                  onClick={() => handleSetQuickDate("thisMonth")}
                  className="h-6 px-2 text-[11px]">
                  Este mes
                </Button>
              </div>
            </div>

            <div className="grid gap-3 sm:grid-cols-3">
              <div>
                <Label htmlFor="export-from-date" className="text-xs text-muted-foreground">
                  Desde
                </Label>
                <Input
                  id="export-from-date"
                  type="date"
                  value={dateRange.from}
                  onChange={(e) =>
                    setDateRange((prev) => ({ ...prev, from: e.target.value }))
                  }
                  className="mt-1 h-8 text-xs"
                />
              </div>

              <div>
                <Label htmlFor="export-to-date" className="text-xs text-muted-foreground">
                  Hasta
                </Label>
                <Input
                  id="export-to-date"
                  type="date"
                  value={dateRange.to}
                  onChange={(e) =>
                    setDateRange((prev) => ({ ...prev, to: e.target.value }))
                  }
                  className="mt-1 h-8 text-xs"
                />
              </div>

              <div>
                <Label htmlFor="export-status-select" className="text-xs text-muted-foreground">
                  Estado
                </Label>
                <Select
                  value={statusFilter}
                  onValueChange={(val) =>
                    setStatusFilter(val as CrmPaymentStatus | "all")
                  }>
                  <SelectTrigger id="export-status-select" size="sm" className="mt-1 h-8 text-xs w-full">
                    <SelectValue placeholder="Todos los estados" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="all">Todos los estados</SelectItem>
                    {CRM_PAYMENT_STATUSES.map((status) => (
                      <SelectItem key={status} value={status}>
                        {CRM_PAYMENT_STATUS_LABELS[status]}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
            </div>
          </div>

          {/* DYNAMIC SELECTION SUMMARY BANNER */}
          <div className="flex items-center justify-between rounded-xl border border-emerald-500/30 bg-emerald-500/5 px-3.5 py-2.5 text-xs">
            <div className="flex items-center gap-2">
              <div className="flex size-6 items-center justify-center rounded-full bg-emerald-500/20 text-emerald-600 dark:text-emerald-400">
                <Check className="size-3.5" aria-hidden="true" />
              </div>
              <div>
                <span className="font-semibold text-foreground">
                  {selectedBanks.length === 0 ? (
                    <span className="text-destructive font-normal">
                      Ningún banco seleccionado
                    </span>
                  ) : isAllSelected ? (
                    "Todos los bancos receptores seleccionados"
                  ) : (
                    `${selectedBanks.length} ${
                      selectedBanks.length === 1 ? "banco seleccionado" : "bancos seleccionados"
                    } (${selectedBanks.join(", ")})`
                  )}
                </span>
                <p className="text-[11px] text-muted-foreground">
                  Período: {dateRange.from || "—"} al {dateRange.to || "—"}
                </p>
              </div>
            </div>

            {selectionSummary.count > 0 ? (
              <div className="text-right">
                <span className="font-bold text-foreground">
                  ~{selectionSummary.count} pagos
                </span>
                <p className="font-semibold text-emerald-600 dark:text-emerald-400 text-[11px]">
                  {formatPaymentAmount(selectionSummary.amount)}
                </p>
              </div>
            ) : null}
          </div>
        </div>

        <DialogFooter className="gap-2 sm:gap-2">
          <Button
            type="button"
            variant="ghost"
            onClick={() => onOpenChange(false)}
            disabled={isExporting}
            className="text-xs">
            Cancelar
          </Button>

          <Button
            type="button"
            variant="outline"
            onClick={() => handleExecuteExport("csv")}
            disabled={isExporting || selectedBanks.length === 0}
            className="text-xs gap-1.5"
            aria-label="Descargar en formato CSV">
            {isExporting && exportFormat === "csv" ? (
              <Loader2 className="size-3.5 animate-spin" aria-hidden="true" />
            ) : (
              <Download className="size-3.5" aria-hidden="true" />
            )}
            Descargar CSV
          </Button>

          <Button
            type="button"
            onClick={() => handleExecuteExport("xls")}
            disabled={isExporting || selectedBanks.length === 0}
            className="gap-2 text-xs font-semibold bg-emerald-600 hover:bg-emerald-700 text-white dark:bg-emerald-600 dark:hover:bg-emerald-500 shadow-sm"
            aria-label="Exportar y descargar tabla Excel">
            {isExporting && exportFormat === "xls" ? (
              <>
                <Loader2 className="size-4 animate-spin" aria-hidden="true" />
                Generando Excel...
              </>
            ) : (
              <>
                <FileSpreadsheet className="size-4" aria-hidden="true" />
                Descargar Excel (.xls)
              </>
            )}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
};
