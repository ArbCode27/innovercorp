"use client";

import { Wrench } from "lucide-react";
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
import { CRM_SURFACES } from "../../_lib/crm-theme";
import type { TechnicianPerformanceMetric } from "@/lib/crm-performance";

interface TechniciansRankingTableProps {
  technicians: TechnicianPerformanceMetric[];
}

const renderRankBadge = (rank: number, hasTickets: boolean) => {
  if (!hasTickets) {
    return <span className="text-xs text-muted-foreground font-mono">—</span>;
  }
  if (rank === 1) {
    return (
      <span className="inline-flex size-7 items-center justify-center rounded-full bg-sky-500/15 text-sm font-bold text-sky-600 dark:text-sky-400">
        🥇 1
      </span>
    );
  }
  if (rank === 2) {
    return (
      <span className="inline-flex size-7 items-center justify-center rounded-full bg-slate-400/20 text-sm font-bold text-slate-600 dark:text-slate-300">
        🥈 2
      </span>
    );
  }
  if (rank === 3) {
    return (
      <span className="inline-flex size-7 items-center justify-center rounded-full bg-amber-700/15 text-sm font-bold text-amber-700 dark:text-amber-500">
        🥉 3
      </span>
    );
  }
  return (
    <span className="inline-flex size-7 items-center justify-center rounded-full bg-muted text-xs font-semibold text-muted-foreground">
      #{rank}
    </span>
  );
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
        <Table className="min-w-[850px]">
          <TableHeader>
            <TableRow className={`${CRM_SURFACES.border} hover:bg-transparent`}>
              <TableHead className="w-16 text-center">Rank</TableHead>
              <TableHead>Técnico de Campo</TableHead>
              <TableHead className="text-center">Asignados</TableHead>
              <TableHead className="text-center">Resueltos</TableHead>
              <TableHead className="text-center">Pendientes</TableHead>
              <TableHead className="text-center">Tasa de Resolución</TableHead>
              <TableHead className="text-center">Puntualidad</TableHead>
              <TableHead className="text-center">Tiempo Promedio</TableHead>
              <TableHead className="text-right">Puntaje</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {technicians.map((tech) => {
              const hasTickets = tech.totalAssigned > 0;
              return (
                <TableRow
                  key={tech.employeeId}
                  className={`${CRM_SURFACES.border} ${CRM_SURFACES.hover} ${
                    tech.rank === 1 && hasTickets ? "bg-sky-500/5 font-medium" : ""
                  }`}>
                  <TableCell className="text-center font-medium">
                    {renderRankBadge(tech.rank, hasTickets)}
                  </TableCell>
                  <TableCell>
                    <div className="flex items-center gap-3">
                      <div className="flex size-8 shrink-0 items-center justify-center rounded-full bg-sky-500/10 text-sky-600 dark:text-sky-400 font-bold text-xs">
                        {tech.name.slice(0, 2).toUpperCase()}
                      </div>
                      <div className="min-w-0">
                        <p className="truncate font-medium text-sm text-foreground">
                          {tech.name}
                        </p>
                        <p className="truncate text-[11px] text-muted-foreground font-mono">
                          ID: {tech.employeeId}
                        </p>
                      </div>
                    </div>
                  </TableCell>
                  <TableCell className="text-center font-medium text-sm">
                    {tech.totalAssigned}
                  </TableCell>
                  <TableCell className="text-center font-medium text-sm text-emerald-600 dark:text-emerald-400">
                    {tech.resolvedCount}
                  </TableCell>
                  <TableCell className="text-center font-medium text-sm text-amber-600 dark:text-amber-400">
                    {tech.pendingCount}
                  </TableCell>
                  <TableCell className="text-center">
                    {hasTickets ? (
                      <Badge
                        variant="secondary"
                        className={`text-xs ${
                          tech.resolutionRate >= 80
                            ? "bg-emerald-500/10 text-emerald-600 dark:text-emerald-400"
                            : tech.resolutionRate >= 50
                              ? "bg-amber-500/10 text-amber-600 dark:text-amber-400"
                              : "bg-red-500/10 text-red-600 dark:text-red-400"
                        }`}>
                        {tech.resolutionRate}%
                      </Badge>
                    ) : (
                      <span className="text-xs text-muted-foreground">—</span>
                    )}
                  </TableCell>
                  <TableCell className="text-center">
                    {tech.resolvedCount > 0 ? (
                      <Badge
                        variant="outline"
                        className={`text-xs ${
                          tech.punctualityRate >= 90
                            ? "border-emerald-500/40 text-emerald-600 dark:text-emerald-400"
                            : tech.punctualityRate >= 70
                              ? "border-amber-500/40 text-amber-600 dark:text-amber-400"
                              : "border-red-500/40 text-red-600 dark:text-red-400"
                        }`}>
                        {tech.punctualityRate}%
                      </Badge>
                    ) : (
                      <span className="text-xs text-muted-foreground">—</span>
                    )}
                  </TableCell>
                  <TableCell className="text-center text-sm text-muted-foreground">
                    {tech.resolvedCount > 0 ? `${tech.avgResolutionHours}h` : "—"}
                  </TableCell>
                  <TableCell className="text-right">
                    {hasTickets && tech.resolvedCount > 0 ? (
                      <Badge
                        variant="outline"
                        className={`font-semibold text-xs ${
                          tech.rank === 1
                            ? "border-sky-500/50 bg-sky-500/10 text-sky-600 dark:text-sky-400"
                            : "border-border text-foreground"
                        }`}>
                        {tech.score} pts
                      </Badge>
                    ) : (
                      <span className="text-xs text-muted-foreground">0 pts</span>
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
