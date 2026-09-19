import { Badge } from "@/components/ui/badge"
import { cn } from "@/lib/utils"
import { formatUnreadCount } from "../../_lib/conversation-inbox-utils"
import { CRM_COUNT_BADGE } from "../../_lib/crm-theme"

interface UnreadCountBadgeProps {
  count: number
}

export const UnreadCountBadge = ({ count }: UnreadCountBadgeProps) => {
  if (count <= 0) return null

  return (
    <Badge
      variant="warning"
      className={cn("min-w-5 px-1.5 py-0.5 text-[10px]", CRM_COUNT_BADGE)}
      aria-hidden="true">
      {formatUnreadCount(count)}
    </Badge>
  )
}
