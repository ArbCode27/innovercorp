"use client";

import type { KeyboardEvent } from "react";
import {
  Check,
  Coins,
  CreditCard,
  DollarSign,
  Landmark,
  Wallet,
  X,
  Zap,
} from "lucide-react";
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

  if (normalized.includes("bancamiga") || normalized.includes("amiga")) {
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

  if (normalized.includes("binance") || normalized.includes("usdt")) {
    return {
      displayName: "Binance",
      subName: "USDT · Cripto",
      icon: Coins,
      badgeColor:
        "bg-amber-500/10 text-amber-600 dark:text-amber-400 border-amber-500/20",
      activeRing:
        "ring-2 ring-amber-500/50 border-amber-500/60 bg-amber-500/5",
    };
  }

  if (
    normalized.includes("tarjeta") ||
    normalized.includes("debito") ||
    normalized.includes("débito") ||
    normalized.includes("debido") ||
    normalized.includes("pos") ||
    normalized.includes("punto")
  ) {
    return {
      displayName: "Tarjeta de Débito",
      subName: "Punto de Venta · POS",
      icon: CreditCard,
      badgeColor:
        "bg-violet-500/10 text-violet-600 dark:text-violet-400 border-violet-500/20",
      activeRing:
        "ring-2 ring-violet-500/50 border-violet-500/60 bg-violet-500/5",
    };
  }

  if (normalized.includes("zelle")) {
    return {
      displayName: "Zelle",
      subName: "Transferencia USD",
      icon: Zap,
      badgeColor:
        "bg-purple-500/10 text-purple-600 dark:text-purple-400 border-purple-500/20",
      activeRing:
        "ring-2 ring-purple-500/50 border-purple-500/60 bg-purple-500/5",
    };
  }

  if (normalized.includes("paypal")) {
    return {
      displayName: "PayPal",
      subName: "Billetera Digital",
      icon: DollarSign,
      badgeColor:
        "bg-sky-500/10 text-sky-600 dark:text-sky-400 border-sky-500/20",
      activeRing:
        "ring-2 ring-sky-500/50 border-sky-500/60 bg-sky-500/5",
    };
  }

  return {
    displayName: bank,
    subName: "Cuenta",
    icon: Landmark,
    badgeColor:
      "bg-zinc-500/10 text-zinc-600 dark:text-zinc-400 border-zinc-500/20",
    activeRing:
      "ring-2 ring-zinc-500/50 border-zinc-500/60 bg-zinc-500/5",
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
            Ingresos Recibidos por Banco
          </span>
          <span className="text-[11px] text-muted-foreground">
            (Solo pagos aprobados · Clic para filtrar)
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

      <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3 2xl:grid-cols-6">
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
                      {stat.approvedCount}{" "}
                      {stat.approvedCount === 1 ? "aprobado" : "aprobados"}
                    </Badge>
                  )}
                </div>

                <div className="mt-3">
                  <div className="flex items-baseline justify-between gap-2">
                    <p className="text-xl font-bold tracking-tight text-foreground sm:text-2xl">
                      {formatPaymentAmount(stat.approvedAmount)}
                    </p>
                    <span className="text-[11px] font-medium text-emerald-600 dark:text-emerald-400">
                      {stat.approvedCount} {stat.approvedCount === 1 ? "aprobado" : "aprobados"}
                    </span>
                  </div>
                  <p className="mt-1 text-[11px] text-muted-foreground">
                    {stat.totalPayments > 0 ? (
                      <>
                        <span>Total registrados: {stat.totalPayments}</span>
                        {stat.inProcessCount > 0 ? (
                          <span> · {stat.inProcessCount} en proceso ({formatPaymentAmount(stat.inProcessAmount)})</span>
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
