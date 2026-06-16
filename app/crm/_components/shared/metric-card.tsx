import { Card, CardContent } from "@/components/ui/card";
import type { LucideIcon } from "lucide-react";

interface MetricCardProps {
  title: string;
  value: string | number;
  description?: string;
  icon?: LucideIcon;
  tone?: "blue" | "green" | "amber" | "red" | "purple";
}

const tones = {
  blue: "text-blue-300",
  green: "text-emerald-300",
  amber: "text-amber-300",
  red: "text-red-300",
  purple: "text-violet-300",
};

export const MetricCard = ({
  title,
  value,
  description,
  icon: Icon,
  tone = "blue",
}: MetricCardProps) => (
  <Card className="border-white/10 bg-[#161922] text-slate-100">
    <CardContent className="flex items-start justify-between p-4">
      <div>
        <p className="text-xs text-slate-400">{title}</p>
        <p className={`mt-1 text-2xl font-semibold ${tones[tone]}`}>{value}</p>
        {description ? <p className="mt-1 text-[11px] text-slate-500">{description}</p> : null}
      </div>
      {Icon ? <Icon className={`size-5 ${tones[tone]}`} aria-hidden="true" /> : null}
    </CardContent>
  </Card>
);
