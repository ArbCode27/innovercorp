"use client";

import type { KeyboardEvent } from "react";
import { Building2, Check, Landmark, Wallet, X } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent } from "@/components/ui/card";
import { cn } from "@/lib/utils";
import {
  formatPaymentAmount,
  type CrmPaymentBankStat,
} from "../../_lib/payments";

interface PaymentsBankCardsProps {
  bankStats: CrmPaymentBankStat[];
  selectedBank: string;
  onSelectBank: (bank: string) => void;
}

const getBankMeta = (bank: string) => {
  const normalized = bank.toLowerCase();

  if (normalized.includes("venezuela") || normalized.includes("bdv")) {
    return {
      displayName: "Banco de Venezuela",
      subName: "BDV",
      icon: Building2,
      badgeColor: "bg-red-500/10 text-red-600 dark:text-red-400 border-red-500/20",
      activeRing: "ring-2 ring-red-500/50 border-red-500/60 bg-red-500/5",
    };
  }

  if (normalized.includes("bancamiga")) {
    return {
      displayName: "Bancamiga",
      subName: "Receptor",
      icon: Landmark,
      badgeColor:
        "bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 border-emerald-500/20",
      activeRing:
        "ring-2 ring-emerald-500/50 border-emerald-500/60 bg-emerald-500/5",
    };
  }

  if (normalized.includes("banplus")) {
    return {
      displayName: "Banplus",
      subName: "Receptor",
      icon: Wallet,
      badgeColor:
        "bg-blue-500/10 text-blue-600 dark:text-blue-400 border-blue-500/20",
      activeRing: "ring-2 ring-blue-500/50 border-blue-500/60 bg-blue-500/5",
    };
  }

  return {
    displayName: bank,
    subName: "Cuenta",
    icon: Landmark,
    badgeColor:
      "bg-purple-500/10 text-purple-600 dark:text-purple-400 border-purple-500/20",
    activeRing:
      "ring-2 ring-purple-500/50 border-purple-500/60 bg-purple-500/5",
  };
};

export const PaymentsBankCards = ({
  bankStats,
  selectedBank,
  onSelectBank,
}: PaymentsBankCardsProps) => {
  if (!bankStats.length) return null;

  const handleKeyDown = (e: KeyboardEvent<HTMLDivElement>, bankName: string) => {
    if (e.key === "Enter" || e.key === " ") {
      e.preventDefault();
      onSelectBank(bankName);
    }
  };

  const isBankFiltered = selectedBank !== "all";

  return (
    <div className="space-y-2">
      <div className="flex items-center justify-between px-0.5">
        <div className="flex items-center gap-2">
          <span className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">
            Cuentas Receptoras Registradas
          </span>
          <span className="text-[11px] text-muted-foreground">
            (Haz clic en un banco para filtrar)
          </span>
        </div>

        {isBankFiltered ? (
          <button
            type="button"
            onClick={() => onSelectBank("all")}
            className="inline-flex cursor-pointer items-center gap-1 text-xs font-medium text-primary hover:underline focus:outline-hidden"
            aria-label="Quitar filtro de banco">
            <X className="size-3" aria-hidden="true" />
            Mostrar todos los bancos
          </button>
        ) : null}
      </div>

      <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4">
        {bankStats.map((stat) => {
          const meta = getBankMeta(stat.bank);
          const Icon = meta.icon;
          const isSelected = selectedBank === stat.bank;

          return (
            <Card
              key={stat.bank}
              role="button"
              tabIndex={0}
              aria-pressed={isSelected}
              aria-label={`Filtrar pagos recibidos en ${meta.displayName}`}
              onClick={() => onSelectBank(stat.bank)}
              onKeyDown={(e) => handleKeyDown(e, stat.bank)}
              className={cn(
                "group relative cursor-pointer overflow-hidden py-3.5 transition-all duration-200 hover:shadow-xs",
                isSelected
                  ? meta.activeRing
                  : "hover:border-primary/40 hover:bg-accent/30",
              )}>
              <CardContent className="px-4">
                <div className="flex items-start justify-between gap-2">
                  <div className="flex items-center gap-2">
                    <div
                      className={cn(
                        "flex size-8 shrink-0 items-center justify-center rounded-lg border",
                        meta.badgeColor,
                      )}>
                      <Icon className="size-4" aria-hidden="true" />
                    </div>
                    <div>
                      <h4 className="text-sm font-semibold tracking-tight text-foreground">
                        {meta.displayName}
                      </h4>
                      <p className="text-[11px] text-muted-foreground">
                        {meta.subName}
                      </p>
                    </div>
                  </div>

                  {isSelected ? (
                    <Badge
                      variant="secondary"
                      className="gap-1 border-primary/30 bg-primary/10 text-[10px] font-medium text-primary">
                      <Check className="size-3" aria-hidden="true" />
                      Activo
                    </Badge>
                  ) : (
                    <Badge
                      variant="outline"
                      className="border-border/60 text-[10px] font-normal text-muted-foreground">
                      {stat.totalPayments}{" "}
                      {stat.totalPayments === 1 ? "pago" : "pagos"}
                    </Badge>
                  )}
                </div>

                <div className="mt-3">
                  <p className="text-xl font-bold tracking-tight text-foreground sm:text-2xl">
                    {formatPaymentAmount(stat.totalAmount)}
                  </p>
                  <p className="mt-1 text-[11px] text-muted-foreground">
                    {stat.totalPayments > 0 ? (
                      <>
                        <span className="font-medium text-emerald-600 dark:text-emerald-400">
                          {stat.approvedCount} aprobados (
                          {formatPaymentAmount(stat.approvedAmount)})
                        </span>
                        {stat.inProcessCount > 0 ? (
                          <span> · {stat.inProcessCount} en proceso</span>
                        ) : null}
                      </>
                    ) : (
                      "Sin pagos en este período"
                    )}
                  </p>
                </div>
              </CardContent>
            </Card>
          );
        })}
      </div>
    </div>
  );
};
