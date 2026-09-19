import { Toggle } from "@/components/ui/toggle"

interface CrmFilterChipProps {
  label: string
  count?: number
  isActive: boolean
  onClick: () => void
}

export const CrmFilterChip = ({
  label,
  count,
  isActive,
  onClick,
}: CrmFilterChipProps) => {
  const countText = count === undefined ? "" : ` ${count}`
  const accessibleLabel =
    count === undefined ? label : `${label}, ${count} conversaciones`

  return (
    <Toggle
      variant="outline"
      size="sm"
      pressed={isActive}
      onPressedChange={() => onClick()}
      aria-label={accessibleLabel}
      className="shrink-0"
    >
      {`${label}${countText}`}
    </Toggle>
  )
}
