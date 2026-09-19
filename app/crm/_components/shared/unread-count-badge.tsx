import { Badge } from "@/components/ui/badge"
import { formatUnreadCount } from "../../_lib/conversation-inbox-utils"

interface UnreadCountBadgeProps {
  count: number
}

export const UnreadCountBadge = ({ count }: UnreadCountBadgeProps) => {
  if (count <= 0) return null

  return (
    <Badge variant="warning" className="min-w-5 px-1.5 py-0.5 text-[10px] font-bold" aria-hidden="true">
      {formatUnreadCount(count)}
    </Badge>
  )
}
