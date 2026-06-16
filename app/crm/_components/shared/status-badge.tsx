import { Badge } from "@/components/ui/badge";
import { STATUS_LABELS } from "../../_lib/constants";

interface StatusBadgeProps {
  status: string;
}

const statusClasses: Record<string, string> = {
  abierto: "border-blue-400/30 bg-blue-400/10 text-blue-300",
  "Abierto": "border-blue-400/30 bg-blue-400/10 text-blue-300",
  proceso: "border-amber-400/30 bg-amber-400/10 text-amber-300",
  "En proceso": "border-amber-400/30 bg-amber-400/10 text-amber-300",
  resuelto: "border-emerald-400/30 bg-emerald-400/10 text-emerald-300",
  "Resuelto": "border-emerald-400/30 bg-emerald-400/10 text-emerald-300",
  online: "border-emerald-400/30 bg-emerald-400/10 text-emerald-300",
  busy: "border-amber-400/30 bg-amber-400/10 text-amber-300",
  offline: "border-slate-500/30 bg-slate-500/10 text-slate-300",
  inactive: "border-red-400/30 bg-red-400/10 text-red-300",
  bot: "border-violet-400/30 bg-violet-400/10 text-violet-300",
  human: "border-red-400/30 bg-red-400/10 text-red-300",
};

export const StatusBadge = ({ status }: StatusBadgeProps) => (
  <Badge
    variant="outline"
    className={`rounded-full border px-2 py-0.5 text-[11px] font-medium ${
      statusClasses[status] || "border-white/10 bg-white/5 text-slate-300"
    }`}
  >
    {STATUS_LABELS[status] || status}
  </Badge>
);
