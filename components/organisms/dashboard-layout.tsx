"use client"

import type React from "react"

import { DashboardSidebar } from "@/components/molecules/dashboard-sidebar"
import { DashboardHeader } from "@/components/molecules/dashboard-header"
import { ProtectedRoute } from "@/components/protected-route"

interface DashboardLayoutProps {
  children: React.ReactNode
}

export function DashboardLayout({ children }: DashboardLayoutProps) {
  return (
    <ProtectedRoute>
      <div className="min-h-screen bg-background">
        <div className="flex">
          <DashboardSidebar />
          <div className="flex-1 md:ml-0">
            <DashboardHeader />
            <main className="p-6">{children}</main>
          </div>
        </div>
      </div>
    </ProtectedRoute>
  )
}
