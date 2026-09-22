"use client";

import { AlertCircle, HelpCircle, Info, Wrench } from "lucide-react";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { Badge } from "@/components/ui/badge";
import { Card } from "@/components/ui/card";
import {
  Tooltip,
  TooltipContent,
  TooltipTrigger,
} from "@/components/ui/tooltip";
import { CRM_SURFACES } from "../../_lib/crm-theme";
import {
  formatDurationHours,
  formatNumber,
} from "@/lib/crm-performance-formatters";
import type { TechnicianPerformanceMetric } from "@/lib/crm-performance";

interface TechniciansRankingTableProps {
  technicians: TechnicianPerformanceMetric[];
}

const renderRankBadge = (rank: number, hasTickets: boolean) => {
  if (!hasTickets) {
    return <span className="text-xs text-muted-foreground/70 font-mono">—</span>;
  }
  if (rank === 1) {
    return (
      <span className="inline-flex size-7 items-center justify-center rounded-full bg-amber-500/15 text-sm font-bold text-amber-600 dark:text-amber-400 shadow-xs">
        🥇 1
      </span>
    );
  }
  if (rank === 2) {
    return (
      <span className="inline-flex size-7 items-center justify-center rounded-full bg-slate-400/20 text-sm font-bold text-slate-700 dark:text-slate-300 shadow-xs">
        🥈 2
      </span>
    );
  }
  if (rank === 3) {
    return (
      <span className="inline-flex size-7 items-center justify-center rounded-full bg-amber-700/15 text-sm font-bold text-amber-800 dark:text-amber-500 shadow-xs">
        🥉 3
      </span>
    );
  }
  return (
    <span className="inline-flex size-7 items-center justify-center rounded-full bg-muted/60 text-xs font-semibold text-muted-foreground">
      #{rank}
    </span>
  );
};

const getScoreBadgeClasses = (rank: number, hasTickets: boolean) => {
  if (!hasTickets) return "border-border/40 text-muted-foreground bg-muted/20";
  if (rank === 1) {
    return "border-amber-500/50 bg-amber-500/15 text-amber-700 dark:text-amber-400";
  }
  if (rank === 2) {
    return "border-slate-400/50 bg-slate-400/20 text-slate-700 dark:text-slate-300";
  }
  if (rank === 3) {
    return "border-amber-700/50 bg-amber-700/20 text-amber-800 dark:text-amber-500";
  }
  return "border-border/60 bg-muted/30 text-foreground";
};

const getProgressBarColor = (rank: number) => {
  if (rank === 1) return "bg-amber-500";
  if (rank === 2) return "bg-slate-400 dark:bg-slate-300";
  if (rank === 3) return "bg-amber-600 dark:bg-amber-500";
  return "bg-sky-500/80";
};

export const TechniciansRankingTable = ({
  technicians,
}: TechniciansRankingTableProps) => {
  if (!technicians.length) {
    return (
      <Card className="p-8 text-center text-muted-foreground">
        No hay datos de técnicos registrados en este período.
      </Card>
    );
  }

  return (
    <Card className="overflow-hidden py-0">
      <div className="overflow-x-auto">
        <Table className="min-w-[900px]">
          <TableHeader>
            <TableRow className={`${CRM_SURFACES.border} hover:bg-transparent`}>
              <TableHead className="w-16 text-center">
                <div className="inline-flex items-center justify-center gap-1">
                  <span>Rank</span>
                  <Tooltip>
                    <TooltipTrigger asChild>
                      <HelpCircle className="size-3 text-muted-foreground/70 cursor-help" />
                    </TooltipTrigger>
                    <TooltipContent side="top">
                      Posición en el ranking según el puntaje bayesiano ajustado
                    </TooltipContent>
                  </Tooltip>
                </div>
              </TableHead>

              <TableHead>
                <div className="inline-flex items-center gap-1">
                  <span>Técnico de Campo</span>
                  <Tooltip>
                    <TooltipTrigger asChild>
                      <HelpCircle className="size-3 text-muted-foreground/70 cursor-help" />
                    </TooltipTrigger>
                    <TooltipContent side="top">
                      Nombre y código de empleado en Wispro
                    </TooltipContent>
                  </Tooltip>
                </div>
              </TableHead>

              <TableHead className="text-center">
                <div className="inline-flex items-center justify-center gap-1">
                  <span>Asignados</span>
                  <Tooltip>
                    <TooltipTrigger asChild>
                      <HelpCircle className="size-3 text-muted-foreground/70 cursor-help" />
                    </TooltipTrigger>
                    <TooltipContent side="top">
                      Total de tickets asignados al técnico en el período
                    </TooltipContent>
                  </Tooltip>
                </div>
              </TableHead>

              <TableHead className="text-center">
                <div className="inline-flex items-center justify-center gap-1">
                  <span>Resueltos</span>
                  <Tooltip>
                    <TooltipTrigger asChild>
                      <HelpCircle className="size-3 text-muted-foreground/70 cursor-help" />
                    </TooltipTrigger>
                    <TooltipContent side="top">
                      Tickets finalizados con éxito (umbral de confianza: 5 tickets, podio: 5 tickets)
                    </TooltipContent>
                  </Tooltip>
                </div>
              </TableHead>

              <TableHead className="text-center">
                <div className="inline-flex items-center justify-center gap-1">
                  <span>Pendientes</span>
                  <Tooltip>
                    <TooltipTrigger asChild>
                      <HelpCircle className="size-3 text-muted-foreground/70 cursor-help" />
                    </TooltipTrigger>
                    <TooltipContent side="top">
                      Tickets abiertos o en estado programado
                    </TooltipContent>
                  </Tooltip>
                </div>
              </TableHead>

              <TableHead className="text-center">
                <div className="inline-flex items-center justify-center gap-1">
                  <span>Tasa de Resolución</span>
                  <Tooltip>
                    <TooltipTrigger asChild>
                      <HelpCircle className="size-3 text-muted-foreground/70 cursor-help" />
                    </TooltipTrigger>
                    <TooltipContent side="top">
                      Efectividad técnica: % de tickets resueltos respecto al total asignado
                    </TooltipContent>
                  </Tooltip>
                </div>
              </TableHead>

              <TableHead className="text-center">
                <div className="inline-flex items-center justify-center gap-1">
                  <span>Puntualidad</span>
                  <Tooltip>
                    <TooltipTrigger asChild>
                      <HelpCircle className="size-3 text-muted-foreground/70 cursor-help" />
                    </TooltipTrigger>
                    <TooltipContent side="top">
                      % de tickets resueltos dentro de la ventana horaria programada
                    </TooltipContent>
                  </Tooltip>
                </div>
              </TableHead>

              <TableHead className="text-center">
                <div className="inline-flex items-center justify-center gap-1">
                  <span>Tiempo Promedio</span>
                  <Tooltip>
                    <TooltipTrigger asChild>
                      <HelpCircle className="size-3 text-muted-foreground/70 cursor-help" />
                    </TooltipTrigger>
                    <TooltipContent side="top">
                      Duración promedio en horas desde el inicio programado/creación hasta el cierre
                    </TooltipContent>
                  </Tooltip>
                </div>
              </TableHead>

              <TableHead className="text-right">
                <div className="inline-flex items-center justify-end gap-1 w-full">
                  <span>Puntaje</span>
                  <Tooltip>
                    <TooltipTrigger asChild>
                      <Info className="size-3.5 text-primary cursor-help" />
                    </TooltipTrigger>
                    <TooltipContent side="top" className="max-w-xs text-left">
                      <p className="font-semibold text-foreground mb-1">
                        Puntaje Ponderado Bayesiano (Modelo IMDB):
                      </p>
                      <p className="text-[11px] text-muted-foreground leading-relaxed">
                        Puntaje = (v / (v + 5)) × Calidad + (5 / (v + 5)) × Media Global.
                        Exige volumen sostenido para confirmar la efectividad y evita que 1 solo ticket con 100% gane el podio.
                      </p>
                    </TooltipContent>
                  </Tooltip>
                </div>
              </TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {technicians.map((tech) => {
              const hasTickets = tech.totalAssigned > 0;
              const hasResolved = tech.resolvedCount > 0;
              const isEligible = tech.isEligibleForPodium ?? (tech.resolvedCount >= 5);
              const durationInfo = formatDurationHours(tech.avgResolutionHours);

              return (
                <TableRow
                  key={tech.employeeId}
                  className={`${CRM_SURFACES.border} transition-colors ${
                    !hasTickets || !hasResolved
                      ? "opacity-50 hover:opacity-75 bg-muted/5"
                      : tech.rank === 1 && isEligible
                        ? "bg-amber-500/5 font-medium hover:bg-amber-500/10"
                        : CRM_SURFACES.hover
                  }`}>
                  <TableCell className="text-center font-medium">
                    {renderRankBadge(tech.rank, hasResolved)}
                  </TableCell>

                  <TableCell>
                    <div className="flex items-center gap-3">
                      <div className="flex size-8 shrink-0 items-center justify-center rounded-full bg-sky-500/10 text-sky-600 dark:text-sky-400 font-bold text-xs ring-1 ring-sky-500/30">
                        {tech.name.slice(0, 2).toUpperCase()}
                      </div>
                      <div className="min-w-0">
                        <div className="flex items-center gap-2">
                          <p className="truncate font-medium text-sm text-foreground">
                            {tech.name}
                          </p>
                          {!hasTickets ? (
                            <Badge
                              variant="outline"
                              className="text-[10px] text-muted-foreground border-border/50 bg-muted/20 font-normal">
                              Sin asignaciones
                            </Badge>
                          ) : !hasResolved ? (
                            <Badge
                              variant="outline"
                              className="text-[10px] text-muted-foreground border-border/50 bg-muted/20 font-normal">
                              Sin resueltos
                            </Badge>
                          ) : !isEligible ? (
                            <Tooltip>
                              <TooltipTrigger asChild>
                                <span className="inline-flex items-center gap-1 rounded bg-amber-500/10 px-1.5 py-0.5 text-[10px] font-medium text-amber-700 dark:text-amber-400 border border-amber-500/30 cursor-help">
                                  <AlertCircle className="size-2.5" />
                                  Volumen insuficiente
                                </span>
                              </TooltipTrigger>
                              <TooltipContent side="top">
                                Menos de 5 tickets resueltos en el período ({tech.resolvedCount}/5). No califica para podio de premiación.
                              </TooltipContent>
                            </Tooltip>
                          ) : null}
                        </div>
                        <p className="truncate text-[11px] text-muted-foreground font-mono">
                          ID: {tech.employeeId}
                        </p>
                      </div>
                    </div>
                  </TableCell>

                  <TableCell className="text-center font-medium text-sm text-foreground">
                    {formatNumber(tech.totalAssigned)}
                  </TableCell>

                  <TableCell className="text-center font-medium text-sm text-emerald-600 dark:text-emerald-400">
                    {formatNumber(tech.resolvedCount)}
                  </TableCell>

                  <TableCell className="text-center font-medium text-sm text-amber-600 dark:text-amber-400">
                    {formatNumber(tech.pendingCount)}
                  </TableCell>

                  <TableCell className="text-center">
                    {hasTickets ? (
                      <Badge
                        variant="secondary"
                        className={`text-xs ${
                          tech.resolutionRate >= 80
                            ? "bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 font-semibold"
                            : tech.resolutionRate >= 50
                              ? "bg-amber-500/10 text-amber-600 dark:text-amber-400 font-semibold"
                              : "bg-red-500/10 text-red-600 dark:text-red-400 font-semibold"
                        }`}>
                        {formatNumber(tech.resolutionRate)}%
                      </Badge>
                    ) : (
                      <span className="text-xs text-muted-foreground/70 font-mono">—</span>
                    )}
                  </TableCell>

                  <TableCell className="text-center">
                    {hasResolved ? (
                      <Badge
                        variant="outline"
                        className={`text-xs ${
                          tech.punctualityRate >= 90
                            ? "border-emerald-500/40 text-emerald-600 dark:text-emerald-400 font-semibold"
                            : tech.punctualityRate >= 70
                              ? "border-amber-500/40 text-amber-600 dark:text-amber-400 font-semibold"
                              : "border-red-500/40 text-red-600 dark:text-red-400 font-semibold"
                        }`}>
                        {formatNumber(tech.punctualityRate)}%
                      </Badge>
                    ) : (
                      <span className="text-xs text-muted-foreground/70 font-mono">—</span>
                    )}
                  </TableCell>

                  <TableCell className="text-center text-sm">
                    {hasResolved ? (
                      <Tooltip>
                        <TooltipTrigger asChild>
                          <span className="font-medium text-foreground cursor-help underline decoration-dotted decoration-muted-foreground/40 underline-offset-4">
                            {durationInfo.display}
                          </span>
                        </TooltipTrigger>
                        <TooltipContent side="top">
                          <p className="text-xs">
                            Tiempo promedio: {durationInfo.daysHours}
                          </p>
                        </TooltipContent>
                      </Tooltip>
                    ) : (
                      <span className="text-xs text-muted-foreground/70 font-mono">—</span>
                    )}
                  </TableCell>

                  <TableCell className="text-right">
                    {hasTickets && hasResolved ? (
                      <div className="flex flex-col items-end gap-1">
                        <Badge
                          variant="outline"
                          className={`font-semibold text-xs ${getScoreBadgeClasses(
                            tech.rank,
                            hasTickets,
                          )}`}>
                          {formatNumber(tech.score, {
                            minimumFractionDigits: 1,
                            maximumFractionDigits: 1,
                          })}{" "}
                          pts
                        </Badge>
                        {/* Mini progress bar indicadora del puntaje */}
                        <div
                          className="h-1 w-16 overflow-hidden rounded-full bg-muted/60"
                          title={`${tech.score}%`}>
                          <div
                            className={`h-full rounded-full transition-all duration-300 ${getProgressBarColor(
                              tech.rank,
                            )}`}
                            style={{
                              width: `${Math.min(100, Math.max(0, tech.score))}%`,
                            }}
                          />
                        </div>
                      </div>
                    ) : (
                      <span className="text-xs text-muted-foreground/70 font-mono">0 pts</span>
                    )}
                  </TableCell>
                </TableRow>
              );
            })}
          </TableBody>
        </Table>
      </div>
    </Card>
  );
};
