import { Badge } from "@/components/ui/badge"
import { formatUnreadCount } from "../../_lib/conversation-inbox-utils"

interface UnreadCountBadgeProps {
  count: number
}

export const UnreadCountBadge = ({ count }: UnreadCountBadgeProps) => {
  if (count <= 0) return null

  return (
    <Badge
      variant="warning"
      className="min-w-5 border-transparent bg-[oklch(0.55_0.15_75)] px-1.5 py-0.5 text-[10px] font-bold text-white"
      aria-hidden="true">
      {formatUnreadCount(count)}
    </Badge>
  )
}
