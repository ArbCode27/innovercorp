import type { LucideIcon } from "lucide-react"
import { Card, CardContent } from "@/components/ui/card"
import { cn } from "@/lib/utils"

interface MetricCardProps {
  title: string
  value: string | number
  description?: string
  icon?: LucideIcon
  tone?: "blue" | "green" | "amber" | "red" | "purple"
}

const tones = {
  blue: "text-crm-accent-muted-foreground",
  green: "text-success-foreground dark:text-success",
  amber: "text-warning-foreground dark:text-warning",
  red: "text-destructive",
  purple: "text-crm-accent-muted-foreground",
}

export const MetricCard = ({
  title,
  value,
  description,
  icon: Icon,
  tone = "blue",
}: MetricCardProps) => (
  <Card className="py-4">
    <CardContent className="flex items-start justify-between px-4">
      <div>
        <p className="text-muted-foreground text-xs">{title}</p>
        <p className={cn("mt-1 text-2xl font-semibold", tones[tone])}>{value}</p>
        {description ? (
          <p className="text-muted-foreground mt-1 text-[11px]">{description}</p>
        ) : null}
      </div>
      {Icon ? <Icon className={cn("size-5", tones[tone])} aria-hidden="true" /> : null}
    </CardContent>
  </Card>
)
