"use client"

import type React from "react"

import Link from "next/link"
import { usePathname } from "next/navigation"
import { cn } from "@/lib/utils"
import type { LucideIcon } from "lucide-react"

interface NavLinkProps {
  href: string
  icon: LucideIcon
  children: React.ReactNode
  className?: string
}

export function NavLink({ href, icon: Icon, children, className }: NavLinkProps) {
  const pathname = usePathname()
  const isActive = pathname === href

  return (
    <Link
      href={href}
      className={cn(
        "flex items-center space-x-3 px-3 py-2 rounded-lg text-sm font-medium transition-colors",
        isActive ? "bg-primary text-primary-foreground" : "text-muted-foreground hover:text-foreground hover:bg-muted",
        className,
      )}
    >
      <Icon className="w-4 h-4" />
      <span>{children}</span>
    </Link>
  )
}
