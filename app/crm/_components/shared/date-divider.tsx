"use client";

import { Badge } from "@/components/ui/badge";

interface DateDividerProps {
  label: string;
}

/** WhatsApp-style day chip between message groups. */
export const DateDivider = ({ label }: DateDividerProps) => (
  <div
    role="separator"
    aria-label={label}
    className="flex justify-center py-1">
    <Badge variant="secondary" className="px-3 py-1 text-[11px] font-medium" asChild>
      <time>{label}</time>
    </Badge>
  </div>
);
