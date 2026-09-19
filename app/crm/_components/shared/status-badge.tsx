import { Badge, type badgeVariants } from "@/components/ui/badge"
import type { VariantProps } from "class-variance-authority"
import { STATUS_LABELS } from "../../_lib/constants"

interface StatusBadgeProps {
  status: string
}

type BadgeVariant = NonNullable<VariantProps<typeof badgeVariants>["variant"]>

const statusVariants: Record<string, BadgeVariant> = {
  abierto: "info",
  Abierto: "info",
  proceso: "warning",
  "En proceso": "warning",
  resuelto: "success",
  Resuelto: "success",
  online: "success",
  busy: "warning",
  offline: "outline",
  inactive: "destructive",
  bot: "secondary",
  human: "destructive",
  RECIBIDO: "info",
  EN_PROCESO: "warning",
  APROBADO: "success",
  RECHAZADO: "destructive",
  DUPLICADO: "outline",
  ERROR: "destructive",
}

export const StatusBadge = ({ status }: StatusBadgeProps) => (
  <Badge variant={statusVariants[status] || "outline"}>
    {STATUS_LABELS[status] || status}
  </Badge>
)
