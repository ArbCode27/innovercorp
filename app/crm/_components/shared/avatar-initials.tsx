"use client"

import { cn } from "@/lib/utils"
import { Avatar, AvatarFallback } from "@/components/ui/avatar"
import { getInitials } from "../../_lib/formatters"

interface AvatarInitialsProps {
  name: string
  initials?: string | null
  color?: string | null
  bg?: string | null
  size?: "sm" | "md" | "lg"
}

const sizeMap = {
  sm: "sm",
  md: "default",
  lg: "lg",
} as const

export const AvatarInitials = ({
  name,
  initials,
  color,
  bg,
  size = "md",
}: AvatarInitialsProps) => (
  <Avatar size={sizeMap[size]} aria-hidden="true">
    <AvatarFallback
      className={cn(!bg && "bg-primary/20 text-primary-foreground")}
      style={
        bg || color
          ? { backgroundColor: bg || undefined, color: color || undefined }
          : undefined
      }
    >
      {initials || getInitials(name)}
    </AvatarFallback>
  </Avatar>
)
