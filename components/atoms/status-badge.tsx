import { Badge } from "@/components/ui/badge";
import { cn } from "@/lib/utils";

interface StatusBadgeProps {
  status: string;
  variant?: "contract" | "equipment";
}

export function StatusBadge({
  status,
  variant = "contract",
}: StatusBadgeProps) {
  const getVariant = () => {
    if (variant === "contract") {
      switch (status) {
        case "APROBADO":
          return "default";
        case "EN_PROCESO":
          return "secondary";
        case "RECHAZADO":
          return "destructive";
        default:
          return "outline";
      }
    } else {
      switch (status) {
        case "Sí":
          return "default";
        case "Pendiente por instalación":
          return "secondary";
        default:
          return "outline";
      }
    }
  };

  const getColor = () => {
    if (variant === "contract") {
      switch (status) {
        case "APROBADO":
          return "bg-green-200 text-green-800 hover:bg-green-100";
        case "EN_PROCESO":
          return "bg-yellow-200 text-yellow-800 hover:bg-yellow-100";
        case "RECHAZADO":
          return "bg-red-200 text-red-800 hover:bg-red-100";
        default:
          return "";
      }
    } else {
      switch (status) {
        case "Sí":
          return "bg-green-100 text-green-800 hover:bg-green-100";
        case "Pendiente por instalación":
          return "bg-orange-100 text-orange-800 hover:bg-orange-100";
        default:
          return "";
      }
    }
  };

  return (
    <Badge variant={getVariant()} className={cn(getColor())}>
      {status}
    </Badge>
  );
}
