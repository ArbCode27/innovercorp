"use client";

import { AlertCircle, HelpCircle, Info, Star, Trophy } from "lucide-react";
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
import { AvatarInitials } from "../shared/avatar-initials";
import { CRM_SURFACES } from "../../_lib/crm-theme";
import {
  formatDurationMinutes,
  formatNumber,
} from "@/lib/crm-performance-formatters";
import type { AgentPerformanceMetric } from "@/lib/crm-performance";

interface AgentsRankingTableProps {
  agents: AgentPerformanceMetric[];
}

const renderRankBadge = (rank: number, hasCases: boolean) => {
  if (!hasCases) {
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

const getScoreBadgeClasses = (rank: number, hasCases: boolean) => {
  if (!hasCases) return "border-border/40 text-muted-foreground bg-muted/20";
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

export const AgentsRankingTable = ({ agents }: AgentsRankingTableProps) => {
  if (!agents.length) {
    return (
      <Card className="p-8 text-center text-muted-foreground">
        No hay datos de asesores registrados en este período.
      </Card>
    );
  }

  return (
    <Card className="overflow-hidden py-0">
      <div className="overflow-x-auto">
        <Table className="min-w-[840px]">
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
                  <span>Asesor de Oficina</span>
                  <Tooltip>
                    <TooltipTrigger asChild>
                      <HelpCircle className="size-3 text-muted-foreground/70 cursor-help" />
                    </TooltipTrigger>
                    <TooltipContent side="top">
                      Nombre y correo institucional del asesor de atención
                    </TooltipContent>
                  </Tooltip>
                </div>
              </TableHead>

              <TableHead className="text-center">
                <div className="inline-flex items-center justify-center gap-1">
                  <span>Casos Resueltos</span>
                  <Tooltip>
                    <TooltipTrigger asChild>
                      <HelpCircle className="size-3 text-muted-foreground/70 cursor-help" />
                    </TooltipTrigger>
                    <TooltipContent side="top">
                      Total de conversaciones resueltas en el período (umbral de confianza: 15 casos, podio: 10 casos)
                    </TooltipContent>
                  </Tooltip>
                </div>
              </TableHead>

              <TableHead className="text-center">
                <div className="inline-flex items-center justify-center gap-1">
                  <span>Tasa No-Reapertura (FCR)</span>
                  <Tooltip>
                    <TooltipTrigger asChild>
                      <HelpCircle className="size-3 text-muted-foreground/70 cursor-help" />
                    </TooltipTrigger>
                    <TooltipContent side="top">
                      Porcentaje de casos resueltos que NO requirieron nuevo contacto dentro de las 24 horas (First Contact Resolution)
                    </TooltipContent>
                  </Tooltip>
                </div>
              </TableHead>

              <TableHead className="text-center">
                <div className="inline-flex items-center justify-center gap-1">
                  <span>Satisfacción Estimada</span>
                  <Tooltip>
                    <TooltipTrigger asChild>
                      <HelpCircle className="size-3 text-muted-foreground/70 cursor-help" />
                    </TooltipTrigger>
                    <TooltipContent side="top">
                      Calificación objetiva calculada en escala 1 a 5 estrellas a partir del FCR
                    </TooltipContent>
                  </Tooltip>
                </div>
              </TableHead>

              <TableHead className="text-center">
                <div className="inline-flex items-center justify-center gap-1">
                  <span>Duración Promedio</span>
                  <Tooltip>
                    <TooltipTrigger asChild>
                      <HelpCircle className="size-3 text-muted-foreground/70 cursor-help" />
                    </TooltipTrigger>
                    <TooltipContent side="top">
                      Tiempo promedio transcurrido desde el primer mensaje hasta el cierre definitivo
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
                        Puntaje = (v / (v + 15)) × Calidad + (15 / (v + 15)) × Media Global.
                        Garantiza que el alto volumen de casos sustente métricas confiables sin premiar muestras pequeñas.
                      </p>
                    </TooltipContent>
                  </Tooltip>
                </div>
              </TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {agents.map((agent) => {
              const hasCases = agent.resolvedCases > 0;
              const durationInfo = formatDurationMinutes(agent.avgDurationMinutes);
              const isEligible = agent.isEligibleForPodium ?? hasCases;

              return (
                <TableRow
                  key={agent.agentId}
                  className={`${CRM_SURFACES.border} transition-colors ${
                    !hasCases
                      ? "opacity-50 hover:opacity-75 bg-muted/5"
                      : agent.rank === 1 && isEligible
                        ? "bg-amber-500/5 font-medium hover:bg-amber-500/10"
                        : CRM_SURFACES.hover
                  }`}>
                  <TableCell className="text-center font-medium">
                    {renderRankBadge(agent.rank, hasCases)}
                  </TableCell>

                  <TableCell>
                    <div className="flex items-center gap-3">
                      <AvatarInitials
                        name={agent.name}
                        initials={agent.initials}
                        color={agent.avatarColor}
                        bg={agent.avatarBg}
                        size="sm"
                      />
                      <div className="min-w-0">
                        <div className="flex items-center gap-2">
                          <p className="truncate font-medium text-sm text-foreground">
                            {agent.name}
                          </p>
                          {!hasCases ? (
                            <Badge
                              variant="outline"
                              className="text-[10px] text-muted-foreground border-border/50 bg-muted/20 font-normal">
                              Sin actividad
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
                                Menos de 10 casos resueltos en el período. No califica para podio de premiación.
                              </TooltipContent>
                            </Tooltip>
                          ) : null}
                        </div>
                        <p className="truncate text-xs text-muted-foreground">
                          {agent.email}
                        </p>
                      </div>
                    </div>
                  </TableCell>

                  <TableCell className="text-center font-medium text-sm text-foreground">
                    {hasCases ? (
                      formatNumber(agent.resolvedCases)
                    ) : (
                      <span className="text-xs text-muted-foreground/70 font-mono">0</span>
                    )}
                  </TableCell>

                  <TableCell className="text-center">
                    {hasCases ? (
                      <Badge
                        variant="secondary"
                        className={`text-xs ${
                          agent.fcrRate >= 90
                            ? "bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 font-semibold"
                            : agent.fcrRate >= 75
                              ? "bg-amber-500/10 text-amber-600 dark:text-amber-400 font-semibold"
                              : "bg-red-500/10 text-red-600 dark:text-red-400 font-semibold"
                        }`}>
                        {formatNumber(agent.fcrRate)}%
                      </Badge>
                    ) : (
                      <span className="text-xs text-muted-foreground/70 font-mono">—</span>
                    )}
                  </TableCell>

                  <TableCell className="text-center">
                    {hasCases ? (
                      <div className="inline-flex items-center gap-1 font-semibold text-sm text-amber-500">
                        <span>{formatNumber(agent.satisfactionRating, { minimumFractionDigits: 1, maximumFractionDigits: 1 })}</span>
                        <Star className="size-3.5 fill-amber-500 text-amber-500" />
                      </div>
                    ) : (
                      <span className="text-xs text-muted-foreground/70 font-mono">—</span>
                    )}
                  </TableCell>

                  <TableCell className="text-center text-sm">
                    {hasCases ? (
                      <Tooltip>
                        <TooltipTrigger asChild>
                          <span className="font-medium text-foreground cursor-help underline decoration-dotted decoration-muted-foreground/40 underline-offset-4">
                            {durationInfo.display}
                          </span>
                        </TooltipTrigger>
                        <TooltipContent side="top">
                          <p className="text-xs">
                            Equivale a {durationInfo.rawFormatted} ({durationInfo.hoursMinutes})
                          </p>
                        </TooltipContent>
                      </Tooltip>
                    ) : (
                      <span className="text-xs text-muted-foreground/70 font-mono">—</span>
                    )}
                  </TableCell>

                  <TableCell className="text-right">
                    {hasCases ? (
                      <div className="flex flex-col items-end gap-1">
                        <Badge
                          variant="outline"
                          className={`font-semibold text-xs ${getScoreBadgeClasses(
                            agent.rank,
                            hasCases,
                          )}`}>
                          {formatNumber(agent.score, {
                            minimumFractionDigits: 1,
                            maximumFractionDigits: 1,
                          })}{" "}
                          pts
                        </Badge>
                        {/* Mini progress bar indicadora del puntaje */}
                        <div
                          className="h-1 w-16 overflow-hidden rounded-full bg-muted/60"
                          title={`${agent.score}%`}>
                          <div
                            className={`h-full rounded-full transition-all duration-300 ${getProgressBarColor(
                              agent.rank,
                            )}`}
                            style={{
                              width: `${Math.min(100, Math.max(0, agent.score))}%`,
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
