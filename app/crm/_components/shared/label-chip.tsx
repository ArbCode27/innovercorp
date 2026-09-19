import { cn } from "@/lib/utils"
import { Badge } from "@/components/ui/badge"
import type { Label } from "../../_lib/types"

interface LabelChipProps {
  label: Label
  selected?: boolean
  onClick?: () => void
  className?: string
}

export const LabelChip = ({ label, selected, onClick, className }: LabelChipProps) => {
  const accessibleLabel = selected ? `${label.name}, seleccionada` : label.name

  return (
    <Badge
      variant={selected ? "secondary" : "outline"}
      asChild={Boolean(onClick)}
      className={cn("gap-1.5", onClick && "cursor-pointer", className)}
      style={{ borderColor: selected ? label.color : undefined }}
    >
      {onClick ? (
        <button
          type="button"
          onClick={onClick}
          aria-pressed={selected}
          aria-label={accessibleLabel}
        >
          <span
            className="size-1.5 shrink-0 rounded-full"
            style={{ backgroundColor: label.color }}
            aria-hidden="true"
          />
          {label.name}
        </button>
      ) : (
        <>
          <span
            className="size-1.5 shrink-0 rounded-full"
            style={{ backgroundColor: label.color }}
            aria-hidden="true"
          />
          {label.name}
        </>
      )}
    </Badge>
  )
}
