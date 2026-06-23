import { Card, CardContent } from "@/components/ui/card";
import type { LucideIcon } from "lucide-react";
import { CRM_SURFACES } from "../../_lib/crm-theme";

interface MetricCardProps {
  title: string;
  value: string | number;
  description?: string;
  icon?: LucideIcon;
  tone?: "blue" | "green" | "amber" | "red" | "purple";
}

const tones = {
  blue: "text-blue-700 dark:text-blue-100",
  green: "text-emerald-700 dark:text-emerald-100",
  amber: "text-amber-700 dark:text-amber-100",
  red: "text-red-700 dark:text-red-100",
  purple: "text-violet-700 dark:text-violet-100",
};

export const MetricCard = ({
  title,
  value,
  description,
  icon: Icon,
  tone = "blue",
}: MetricCardProps) => (
  <Card className={`${CRM_SURFACES.border} ${CRM_SURFACES.elevated} ${CRM_SURFACES.textPrimary}`}>
    <CardContent className="flex items-start justify-between p-4">
      <div>
        <p className={`text-xs ${CRM_SURFACES.textMuted}`}>{title}</p>
        <p className={`mt-1 text-2xl font-semibold ${tones[tone]}`}>{value}</p>
        {description ? (
          <p className={`mt-1 text-[11px] ${CRM_SURFACES.textMuted}`}>{description}</p>
        ) : null}
      </div>
      {Icon ? <Icon className={`size-5 ${tones[tone]}`} aria-hidden="true" /> : null}
    </CardContent>
  </Card>
);
