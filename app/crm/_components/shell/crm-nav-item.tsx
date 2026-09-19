import type { LucideIcon } from "lucide-react"
import { cn } from "@/lib/utils"
import { Button } from "@/components/ui/button"
import { Badge } from "@/components/ui/badge"
import { CRM_COUNT_BADGE } from "../../_lib/crm-theme"
import {
  Tooltip,
  TooltipContent,
  TooltipTrigger,
} from "@/components/ui/tooltip"
import type { CrmView } from "../../_lib/types"

interface CrmNavItemProps {
  icon: LucideIcon
  label: string
  view: CrmView
  isActive: boolean
  badgeCount?: number
  onSelect: (view: CrmView) => void
}

export const CrmNavItem = ({
  icon: Icon,
  label,
  view,
  isActive,
  badgeCount = 0,
  onSelect,
}: CrmNavItemProps) => (
  <Tooltip>
    <TooltipTrigger asChild>
      <Button
        type="button"
        variant={isActive ? "secondary" : "ghost"}
        size="icon"
        aria-label={label}
        aria-current={isActive ? "page" : undefined}
        onClick={() => onSelect(view)}
        className="relative size-10 rounded-2xl"
      >
        <Icon className="size-5" aria-hidden="true" />
        {badgeCount > 0 ? (
          <Badge
            variant="warning"
            className={cn(
              "absolute -right-0.5 -top-0.5 min-w-4 px-1 py-0 text-[10px] leading-4",
              CRM_COUNT_BADGE,
            )}
            aria-hidden="true"
          >
            {badgeCount > 99 ? "99+" : badgeCount}
          </Badge>
        ) : null}
      </Button>
    </TooltipTrigger>
    <TooltipContent side="right">{label}</TooltipContent>
  </Tooltip>
)
