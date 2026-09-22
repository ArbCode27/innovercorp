"use client";

import { useCallback, useEffect, useState } from "react";
import {
  Award,
  Calendar,
  CheckCircle2,
  Clock,
  Headphones,
  RefreshCw,
  Star,
  Trophy,
  Users,
  Wrench,
} from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { BestAgentPodiumCard, BestTechnicianPodiumCard } from "./podium-card";
import { AgentsRankingTable } from "./agents-ranking-table";
import { TechniciansRankingTable } from "./technicians-ranking-table";
import {
  formatDurationMinutes,
  formatNumber,
} from "@/lib/crm-performance-formatters";
import type {
  PerformanceDashboardData,
  PerformancePeriod,
} from "@/lib/crm-performance";

const PERIOD_LABELS: Record<PerformancePeriod, string> = {
  month: "Este mes",
  last_month: "Mes anterior",
  week: "Últimos 7 días",
  all: "Todo el histórico",
};

export const PerformanceView = () => {
  const [period, setPeriod] = useState<PerformancePeriod>("month");
  const [activeTab, setActiveTab] = useState<"agents" | "technicians">("agents");
  const [data, setData] = useState<PerformanceDashboardData | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const loadData = useCallback(async (selectedPeriod: PerformancePeriod) => {
    setIsLoading(true);
    setError(null);
    try {
      const response = await fetch(
        `/api/crm/performance?period=${encodeURIComponent(selectedPeriod)}`,
        { cache: "no-store" },
      );
      if (!response.ok) {
        const errorData = (await response.json().catch(() => ({}))) as {
          error?: string;
        };
        throw new Error(
          errorData.error || "Error al cargar datos de rendimiento",
        );
      }
      const dashboardData = (await response.json()) as PerformanceDashboardData;
      setData(dashboardData);
    } catch (err) {
      const msg =
        err instanceof Error ? err.message : "Error al cargar rendimiento";
      setError(msg);
      toast.error(msg);
    } finally {
      setIsLoading(false);
    }
  }, []);

  useEffect(() => {
    void loadData(period);
  }, [loadData, period]);

  const handlePeriodChange = (nextPeriod: PerformancePeriod) => {
    setPeriod(nextPeriod);
  };

  const summary = data?.summary;

  return (
    <div className="crm-scrollbar min-h-0 flex-1 overflow-y-auto p-4 md:p-6 space-y-6">
      {/* Header */}
      <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <div className="flex items-center gap-2">
            <Trophy className="size-6 text-amber-500" />
            <h1 className="text-xl font-bold tracking-tight md:text-2xl">
              Rendimiento & Ranking
            </h1>
          </div>
          <p className="text-sm text-muted-foreground mt-0.5">
            Evaluación integral de desempeño de asesores en oficina y técnicos de campo.
          </p>
        </div>

        {/* Period Selector & Refresh */}
        <div className="flex items-center gap-2">
          <div className="inline-flex rounded-lg border border-border bg-muted/30 p-1 text-xs">
            {(["month", "last_month", "week", "all"] as PerformancePeriod[]).map(
              (p) => (
                <button
                  key={p}
                  type="button"
                  onClick={() => handlePeriodChange(p)}
                  className={`rounded-md px-2.5 py-1 font-medium transition-colors ${
                    period === p
                      ? "bg-background text-foreground shadow-sm"
                      : "text-muted-foreground hover:text-foreground"
                  }`}>
                  {PERIOD_LABELS[p]}
                </button>
              ),
            )}
          </div>

          <Button
            type="button"
            variant="outline"
            size="icon"
            onClick={() => void loadData(period)}
            disabled={isLoading}
            aria-label="Actualizar métricas">
            <RefreshCw
              className={`size-4 ${isLoading ? "animate-spin text-muted-foreground" : ""}`}
            />
          </Button>
        </div>
      </div>

      {error ? (
        <div className="rounded-xl border border-red-300 bg-red-50 p-4 text-sm text-red-800 dark:border-red-500/40 dark:bg-red-950/40 dark:text-red-100 flex items-center justify-between">
          <p>{error}</p>
          <Button
            size="sm"
            variant="outline"
            onClick={() => void loadData(period)}>
            Reintentar
          </Button>
        </div>
      ) : null}

      {/* KPI Cards */}
      <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">
        <Card className="p-4 space-y-1">
          <div className="flex items-center justify-between text-muted-foreground">
            <span className="text-xs font-medium">Casos de Oficina</span>
            <Headphones className="size-4" />
          </div>
          <p className="text-2xl font-bold tracking-tight">
            {summary ? formatNumber(summary.totalConversationsResolved) : "—"}
          </p>
          <p className="text-[11px] text-muted-foreground truncate" title={summary?.avgAgentDurationMinutes ? `${formatNumber(summary.avgAgentDurationMinutes)} min` : undefined}>
            Tiempo prom: {summary?.avgAgentDurationMinutes ? formatDurationMinutes(summary.avgAgentDurationMinutes).display : "0m"} ({formatNumber(summary?.avgAgentDurationMinutes ?? 0)} min)
          </p>
        </Card>

        <Card className="p-4 space-y-1">
          <div className="flex items-center justify-between text-muted-foreground">
            <span className="text-xs font-medium">Satisfacción (FCR)</span>
            <Star className="size-4 text-amber-500" />
          </div>
          <p className="text-2xl font-bold tracking-tight text-amber-600 dark:text-amber-400">
            {summary ? `${formatNumber(summary.agentFcrRate)}%` : "—"}
          </p>
          <p className="text-[11px] text-muted-foreground">
            Casos resueltos sin reapertura en 24h
          </p>
        </Card>

        <Card className="p-4 space-y-1">
          <div className="flex items-center justify-between text-muted-foreground">
            <span className="text-xs font-medium">Tickets Wispro Resueltos</span>
            <CheckCircle2 className="size-4 text-emerald-500" />
          </div>
          <p className="text-2xl font-bold tracking-tight text-emerald-600 dark:text-emerald-400">
            {summary ? formatNumber(summary.totalTicketsResolved) : "—"}
          </p>
          <p className="text-[11px] text-muted-foreground">
            De {formatNumber(summary?.totalTicketsAssigned ?? 0)} tickets asignados
          </p>
        </Card>

        <Card className="p-4 space-y-1">
          <div className="flex items-center justify-between text-muted-foreground">
            <span className="text-xs font-medium">Efectividad Técnica</span>
            <Wrench className="size-4 text-sky-500" />
          </div>
          <p className="text-2xl font-bold tracking-tight text-sky-600 dark:text-sky-400">
            {summary ? `${formatNumber(summary.technicianResolutionRate)}%` : "—"}
          </p>
          <p className="text-[11px] text-muted-foreground">
            Tasa de resolución global en campo
          </p>
        </Card>
      </div>

      {/* Podium Awards */}
      <div className="space-y-3">
        <div className="flex items-center gap-2">
          <Award className="size-5 text-amber-500" />
          <h2 className="text-lg font-semibold tracking-tight">
            Podio de Premiación ({PERIOD_LABELS[period]})
          </h2>
        </div>

        <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
          <BestAgentPodiumCard agent={data?.bestAgent ?? null} />
          <BestTechnicianPodiumCard technician={data?.bestTechnician ?? null} />
        </div>
      </div>

      {/* Detailed Tables */}
      <div className="space-y-4">
        <div className="flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
          <div className="inline-flex rounded-lg border border-border bg-muted/30 p-1">
            <button
              type="button"
              onClick={() => setActiveTab("agents")}
              className={`flex items-center gap-1.5 rounded-md px-3 py-1.5 text-xs font-medium transition-colors ${
                activeTab === "agents"
                  ? "bg-background text-foreground shadow-sm"
                  : "text-muted-foreground hover:text-foreground"
              }`}>
              <Users className="size-3.5" />
              <span>Asesores de Oficina ({formatNumber(data?.agents.length ?? 0)})</span>
            </button>
            <button
              type="button"
              onClick={() => setActiveTab("technicians")}
              className={`flex items-center gap-1.5 rounded-md px-3 py-1.5 text-xs font-medium transition-colors ${
                activeTab === "technicians"
                  ? "bg-background text-foreground shadow-sm"
                  : "text-muted-foreground hover:text-foreground"
              }`}>
              <Wrench className="size-3.5" />
              <span>Técnicos de Campo ({formatNumber(data?.technicians.length ?? 0)})</span>
            </button>
          </div>
        </div>

        {activeTab === "agents" ? (
          <AgentsRankingTable agents={data?.agents ?? []} />
        ) : (
          <TechniciansRankingTable technicians={data?.technicians ?? []} />
        )}
      </div>
    </div>
  );
};
