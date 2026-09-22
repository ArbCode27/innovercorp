"use client";

import { Star, Trophy } from "lucide-react";
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
import { AvatarInitials } from "../shared/avatar-initials";
import { CRM_SURFACES } from "../../_lib/crm-theme";
import type { AgentPerformanceMetric } from "@/lib/crm-performance";

interface AgentsRankingTableProps {
  agents: AgentPerformanceMetric[];
}

const renderRankBadge = (rank: number, hasCases: boolean) => {
  if (!hasCases) {
    return <span className="text-xs text-muted-foreground font-mono">—</span>;
  }
  if (rank === 1) {
    return (
      <span className="inline-flex size-7 items-center justify-center rounded-full bg-amber-500/15 text-sm font-bold text-amber-600 dark:text-amber-400">
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
        <Table className="min-w-[780px]">
          <TableHeader>
            <TableRow className={`${CRM_SURFACES.border} hover:bg-transparent`}>
              <TableHead className="w-16 text-center">Rank</TableHead>
              <TableHead>Asesor de Oficina</TableHead>
              <TableHead className="text-center">Casos Resueltos</TableHead>
              <TableHead className="text-center">Tasa No-Reapertura (FCR)</TableHead>
              <TableHead className="text-center">Satisfacción Estimada</TableHead>
              <TableHead className="text-center">Duración Promedio</TableHead>
              <TableHead className="text-right">Puntaje</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {agents.map((agent) => {
              const hasCases = agent.resolvedCases > 0;
              return (
                <TableRow
                  key={agent.agentId}
                  className={`${CRM_SURFACES.border} ${CRM_SURFACES.hover} ${
                    agent.rank === 1 && hasCases ? "bg-amber-500/5 font-medium" : ""
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
                        <p className="truncate font-medium text-sm text-foreground">
                          {agent.name}
                        </p>
                        <p className="truncate text-xs text-muted-foreground">
                          {agent.email}
                        </p>
                      </div>
                    </div>
                  </TableCell>
                  <TableCell className="text-center font-medium text-sm">
                    {agent.resolvedCases}
                  </TableCell>
                  <TableCell className="text-center">
                    {hasCases ? (
                      <Badge
                        variant="secondary"
                        className={`text-xs ${
                          agent.fcrRate >= 90
                            ? "bg-emerald-500/10 text-emerald-600 dark:text-emerald-400"
                            : agent.fcrRate >= 75
                              ? "bg-amber-500/10 text-amber-600 dark:text-amber-400"
                              : "bg-red-500/10 text-red-600 dark:text-red-400"
                        }`}>
                        {agent.fcrRate}%
                      </Badge>
                    ) : (
                      <span className="text-xs text-muted-foreground">—</span>
                    )}
                  </TableCell>
                  <TableCell className="text-center">
                    {hasCases ? (
                      <div className="inline-flex items-center gap-1 font-semibold text-sm text-amber-500">
                        <span>{agent.satisfactionRating}</span>
                        <Star className="size-3.5 fill-amber-500 text-amber-500" />
                      </div>
                    ) : (
                      <span className="text-xs text-muted-foreground">—</span>
                    )}
                  </TableCell>
                  <TableCell className="text-center text-sm text-muted-foreground">
                    {hasCases ? `${agent.avgDurationMinutes} min` : "—"}
                  </TableCell>
                  <TableCell className="text-right">
                    {hasCases ? (
                      <Badge
                        variant="outline"
                        className={`font-semibold text-xs ${
                          agent.rank === 1
                            ? "border-amber-500/50 bg-amber-500/10 text-amber-600 dark:text-amber-400"
                            : "border-border text-foreground"
                        }`}>
                        {agent.score} pts
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
