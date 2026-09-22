"use client";

import { AlertTriangle, ArrowDown, ArrowUp, Flame } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import type { TicketPriority } from "@/lib/wispro-types";

interface PriorityConfig {
  label: string;
  className: string;
  icon: typeof Flame;
}

const PRIORITY_CONFIG: Record<TicketPriority, PriorityConfig> = {
  urgent: {
    label: "Urgente",
    className:
      "border-red-500/30 bg-red-500/10 text-red-600 dark:border-red-500/40 dark:bg-red-950/40 dark:text-red-400",
    icon: Flame,
  },
  high: {
    label: "Alta",
    className:
      "border-amber-500/30 bg-amber-500/10 text-amber-600 dark:border-amber-500/40 dark:bg-amber-950/40 dark:text-amber-400",
    icon: AlertTriangle,
  },
  medium: {
    label: "Media",
    className:
      "border-blue-500/30 bg-blue-500/10 text-blue-600 dark:border-blue-500/40 dark:bg-blue-950/40 dark:text-blue-400",
    icon: ArrowUp,
  },
  low: {
    label: "Baja",
    className:
      "border-slate-500/30 bg-slate-500/10 text-slate-600 dark:border-slate-500/40 dark:bg-slate-900/40 dark:text-slate-400",
    icon: ArrowDown,
  },
};

interface PriorityBadgeProps {
  priority?: TicketPriority | null;
  className?: string;
}

export const PriorityBadge = ({ priority, className = "" }: PriorityBadgeProps) => {
  const normalizedPriority = priority && priority in PRIORITY_CONFIG ? priority : "medium";
  const config = PRIORITY_CONFIG[normalizedPriority];
  const Icon = config.icon;

  return (
    <Badge
      variant="outline"
      className={`inline-flex items-center gap-1 font-medium select-none ${config.className} ${className}`}>
      <Icon className="size-3" />
      <span>{config.label}</span>
    </Badge>
  );
};
