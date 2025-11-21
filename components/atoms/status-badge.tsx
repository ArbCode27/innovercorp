import { Badge } from "@/components/ui/badge"
import { cn } from "@/lib/utils"

interface StatusBadgeProps {
  status: string
  variant?: "contract" | "equipment"
}

export function StatusBadge({ status, variant = "contract" }: StatusBadgeProps) {
  const getVariant = () => {
    if (variant === "contract") {
      switch (status) {
        case "Activo":
          return "default"
        case "Pendiente":
          return "secondary"
        case "Vencido":
          return "destructive"
        default:
          return "outline"
      }
    } else {
      switch (status) {
        case "Sí":
          return "default"
        case "Pendiente por instalación":
          return "secondary"
        default:
          return "outline"
      }
    }
  }

  const getColor = () => {
    if (variant === "contract") {
      switch (status) {
        case "Activo":
          return "bg-green-100 text-green-800 hover:bg-green-100"
        case "Pendiente":
          return "bg-yellow-100 text-yellow-800 hover:bg-yellow-100"
        case "Vencido":
          return "bg-red-100 text-red-800 hover:bg-red-100"
        default:
          return ""
      }
    } else {
      switch (status) {
        case "Sí":
          return "bg-green-100 text-green-800 hover:bg-green-100"
        case "Pendiente por instalación":
          return "bg-orange-100 text-orange-800 hover:bg-orange-100"
        default:
          return ""
      }
    }
  }

  return (
    <Badge variant={getVariant()} className={cn(getColor())}>
      {status}
    </Badge>
  )
}
