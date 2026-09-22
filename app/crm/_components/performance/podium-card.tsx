"use client";

import { Award, Clock, Star, Trophy, Wrench, CheckCircle2 } from "lucide-react";
import { Card } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import {
  Tooltip,
  TooltipContent,
  TooltipTrigger,
} from "@/components/ui/tooltip";
import { AvatarInitials } from "../shared/avatar-initials";
import {
  formatDurationHours,
  formatDurationMinutes,
  formatNumber,
} from "@/lib/crm-performance-formatters";
import type {
  AgentPerformanceMetric,
  TechnicianPerformanceMetric,
} from "@/lib/crm-performance";

interface BestAgentPodiumCardProps {
  agent: AgentPerformanceMetric | null;
}

export const BestAgentPodiumCard = ({ agent }: BestAgentPodiumCardProps) => {
  if (!agent) {
    return (
      <Card className="flex flex-col items-center justify-center p-6 text-center border-dashed">
        <Trophy className="size-10 text-muted-foreground/40 mb-2" />
        <p className="text-sm font-medium text-muted-foreground">
          Sin datos suficientes para el podio de asesores en este período
        </p>
        <p className="text-xs text-muted-foreground/70 mt-1">
          (Se requiere un mínimo de 10 casos resueltos para clasificar al podio)
        </p>
      </Card>
    );
  }

  const durationInfo = formatDurationMinutes(agent.avgDurationMinutes);

  return (
    <Card className="relative overflow-hidden border-amber-500/30 bg-gradient-to-br from-amber-500/10 via-background to-background p-5 shadow-sm">
      <div className="absolute top-3 right-3 flex items-center gap-1.5 rounded-full bg-amber-500/20 px-3 py-1 text-xs font-semibold text-amber-700 dark:text-amber-400">
        <Trophy className="size-3.5 fill-amber-500 text-amber-500" />
        <span>#1 Mejor Asesor</span>
      </div>

      <div className="flex items-center gap-3.5 pt-1">
        <div className="relative">
          <AvatarInitials
            name={agent.name}
            initials={agent.initials}
            color={agent.avatarColor}
            bg={agent.avatarBg}
            size="lg"
          />
          <span className="absolute -bottom-1 -right-1 flex size-5 items-center justify-center rounded-full bg-amber-500 text-[11px] text-white shadow">
            🥇
          </span>
        </div>

        <div className="min-w-0 flex-1">
          <div className="flex items-center gap-2">
            <h3 className="truncate font-semibold text-base tracking-tight">
              {agent.name}
            </h3>
            <Badge
              variant="outline"
              className="border-amber-500/40 bg-amber-500/10 text-amber-700 dark:text-amber-400 text-[11px] font-bold">
              {formatNumber(agent.score, {
                minimumFractionDigits: 1,
                maximumFractionDigits: 1,
              })}{" "}
              pts
            </Badge>
          </div>
          <p className="truncate text-xs text-muted-foreground">
            {agent.email || "Asesor de Atención al Cliente"}
          </p>
        </div>
      </div>

      <div className="mt-4 grid grid-cols-3 gap-2 border-t border-border/50 pt-3 text-center">
        <div className="rounded-lg bg-muted/40 p-2">
          <p className="text-[11px] font-medium text-muted-foreground">Casos</p>
          <p className="text-base font-bold text-foreground">
            {formatNumber(agent.resolvedCases)}
          </p>
        </div>
        <div className="rounded-lg bg-muted/40 p-2">
          <p className="text-[11px] font-medium text-muted-foreground">Satisfacción</p>
          <p className="text-base font-bold text-amber-600 dark:text-amber-400 flex items-center justify-center gap-0.5">
            <span>
              {formatNumber(agent.satisfactionRating, {
                minimumFractionDigits: 1,
                maximumFractionDigits: 1,
              })}
            </span>
            <Star className="size-3.5 fill-amber-500 text-amber-500" />
          </p>
        </div>
        <div className="rounded-lg bg-muted/40 p-2">
          <p className="text-[11px] font-medium text-muted-foreground">Duración prom.</p>
          <Tooltip>
            <TooltipTrigger asChild>
              <p className="text-base font-bold text-foreground cursor-help underline decoration-dotted decoration-muted-foreground/40 underline-offset-4">
                {durationInfo.display}
              </p>
            </TooltipTrigger>
            <TooltipContent side="top">
              <p className="text-xs">
                {durationInfo.rawFormatted} ({durationInfo.hoursMinutes})
              </p>
            </TooltipContent>
          </Tooltip>
        </div>
      </div>
    </Card>
  );
};

interface BestTechnicianPodiumCardProps {
  technician: TechnicianPerformanceMetric | null;
}

export const BestTechnicianPodiumCard = ({
  technician,
}: BestTechnicianPodiumCardProps) => {
  if (!technician) {
    return (
      <Card className="flex flex-col items-center justify-center p-6 text-center border-dashed">
        <Award className="size-10 text-muted-foreground/40 mb-2" />
        <p className="text-sm font-medium text-muted-foreground">
          Sin datos suficientes para el podio de técnicos en este período
        </p>
        <p className="text-xs text-muted-foreground/70 mt-1">
          (Se requiere un mínimo de 5 tickets resueltos para clasificar al podio)
        </p>
      </Card>
    );
  }

  return (
    <Card className="relative overflow-hidden border-sky-500/30 bg-gradient-to-br from-sky-500/10 via-background to-background p-5 shadow-sm">
      <div className="absolute top-3 right-3 flex items-center gap-1.5 rounded-full bg-sky-500/20 px-3 py-1 text-xs font-semibold text-sky-700 dark:text-sky-400">
        <Wrench className="size-3.5 text-sky-500" />
        <span>#1 Mejor Técnico</span>
      </div>

      <div className="flex items-center gap-3.5 pt-1">
        <div className="relative">
          <div className="flex size-14 items-center justify-center rounded-full bg-sky-500/20 text-sky-600 dark:text-sky-400 font-bold text-lg ring-2 ring-sky-500/50">
            {technician.name.slice(0, 2).toUpperCase()}
          </div>
          <span className="absolute -bottom-1 -right-1 flex size-5 items-center justify-center rounded-full bg-sky-500 text-[11px] text-white shadow">
            🥇
          </span>
        </div>

        <div className="min-w-0 flex-1">
          <div className="flex items-center gap-2">
            <h3 className="truncate font-semibold text-base tracking-tight">
              {technician.name}
            </h3>
            <Badge
              variant="outline"
              className="border-sky-500/40 bg-sky-500/10 text-sky-700 dark:text-sky-400 text-[11px] font-bold">
              {formatNumber(technician.score, {
                minimumFractionDigits: 1,
                maximumFractionDigits: 1,
              })}{" "}
              pts
            </Badge>
          </div>
          <p className="truncate text-xs text-muted-foreground">
            Técnico Especialista de Campo
          </p>
        </div>
      </div>

      <div className="mt-4 grid grid-cols-3 gap-2 border-t border-border/50 pt-3 text-center">
        <div className="rounded-lg bg-muted/40 p-2">
          <p className="text-[11px] font-medium text-muted-foreground">Resueltos</p>
          <p className="text-base font-bold text-foreground">
            {formatNumber(technician.resolvedCount)}
            <span className="text-xs font-normal text-muted-foreground">
              /{formatNumber(technician.totalAssigned)}
            </span>
          </p>
        </div>
        <div className="rounded-lg bg-muted/40 p-2">
          <p className="text-[11px] font-medium text-muted-foreground">Efectividad</p>
          <p className="text-base font-bold text-sky-600 dark:text-sky-400">
            {formatNumber(technician.resolutionRate)}%
          </p>
        </div>
        <div className="rounded-lg bg-muted/40 p-2">
          <p className="text-[11px] font-medium text-muted-foreground">Puntualidad</p>
          <p className="text-base font-bold text-foreground">
            {formatNumber(technician.punctualityRate)}%
          </p>
        </div>
      </div>
    </Card>
  );
};
