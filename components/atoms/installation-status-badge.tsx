import { Badge } from "@/components/ui/badge"
import { cn } from "@/lib/utils"

interface InstallationStatusBadgeProps {
  status: string
  priority?: string
}

export function InstallationStatusBadge({ status, priority }: InstallationStatusBadgeProps) {
  const getStatusColor = () => {
    switch (status) {
      case "Programada":
        return "bg-blue-100 text-blue-800 hover:bg-blue-100"
      case "En Progreso":
        return "bg-yellow-100 text-yellow-800 hover:bg-yellow-100"
      case "Completada":
        return "bg-green-100 text-green-800 hover:bg-green-100"
      case "Cancelada":
        return "bg-red-100 text-red-800 hover:bg-red-100"
      case "Reprogramada":
        return "bg-orange-100 text-orange-800 hover:bg-orange-100"
      default:
        return "bg-gray-100 text-gray-800 hover:bg-gray-100"
    }
  }

  const getPriorityColor = () => {
    switch (priority) {
      case "Alta":
        return "bg-red-100 text-red-800 hover:bg-red-100"
      case "Media":
        return "bg-yellow-100 text-yellow-800 hover:bg-yellow-100"
      case "Baja":
        return "bg-green-100 text-green-800 hover:bg-green-100"
      default:
        return "bg-gray-100 text-gray-800 hover:bg-gray-100"
    }
  }

  return (
    <div className="flex items-center space-x-1">
      <Badge variant="outline" className={cn(getStatusColor())}>
        {status}
      </Badge>
      {priority && (
        <Badge variant="outline" className={cn(getPriorityColor(), "text-xs")}>
          {priority}
        </Badge>
      )}
    </div>
  )
}
