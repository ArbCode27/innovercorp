"use client";

import { UserRound } from "lucide-react";
import { cn } from "@/lib/utils";
import { Badge } from "@/components/ui/badge";

interface AgentControlBadgeProps {
  name: string;
  className?: string;
}

export const AgentControlBadge = ({ name, className }: AgentControlBadgeProps) => (
  <Badge
    variant="secondary"
    className={cn(
      "max-w-[10rem] gap-1 border border-crm-accent/50 bg-crm-accent/25 px-2 text-[10px] font-semibold text-foreground shadow-sm dark:border-crm-accent/40 dark:bg-crm-accent/30",
      className,
    )}
    title={name}>
    <UserRound className="size-3 shrink-0" aria-hidden="true" />
    <span className="truncate">{name}</span>
  </Badge>
);
