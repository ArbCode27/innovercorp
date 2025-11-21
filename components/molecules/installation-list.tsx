"use client"

import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { InstallationStatusBadge } from "@/components/atoms/installation-status-badge"
import type { Installation } from "@/lib/installation-data"
import { Calendar, Clock, MapPin, User, Eye } from "lucide-react"

interface InstallationListProps {
  installations: Installation[]
  onViewInstallation: (installation: Installation) => void
  title?: string
}

export function InstallationList({
  installations,
  onViewInstallation,
  title = "Próximas Instalaciones",
}: InstallationListProps) {
  const formatDate = (dateString: string) => {
    return new Date(dateString).toLocaleDateString("es-ES", {
      month: "short",
      day: "numeric",
    })
  }

  const formatTime = (timeString: string) => {
    return new Date(`2000-01-01T${timeString}`).toLocaleTimeString("es-ES", {
      hour: "2-digit",
      minute: "2-digit",
    })
  }

  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center space-x-2">
          <Calendar className="w-5 h-5 text-primary" />
          <span>{title}</span>
        </CardTitle>
        <CardDescription>{installations.length} instalaciones programadas</CardDescription>
      </CardHeader>
      <CardContent>
        <div className="space-y-4">
          {installations.length === 0 ? (
            <div className="text-center py-8">
              <Calendar className="w-12 h-12 text-muted-foreground mx-auto mb-4" />
              <p className="text-muted-foreground">No hay instalaciones programadas</p>
            </div>
          ) : (
            installations.map((installation) => (
              <div
                key={installation.id}
                className="flex items-center justify-between p-4 border rounded-lg hover:bg-muted/50 transition-colors"
              >
                <div className="flex-1 space-y-2">
                  <div className="flex items-center space-x-4">
                    <div className="flex items-center space-x-2">
                      <Calendar className="w-4 h-4 text-muted-foreground" />
                      <span className="text-sm font-medium">{formatDate(installation.date)}</span>
                    </div>
                    <div className="flex items-center space-x-2">
                      <Clock className="w-4 h-4 text-muted-foreground" />
                      <span className="text-sm">{formatTime(installation.time)}</span>
                    </div>
                  </div>

                  <div className="flex items-center space-x-2">
                    <User className="w-4 h-4 text-muted-foreground" />
                    <span className="font-medium">{installation.clientName}</span>
                  </div>

                  <div className="flex items-center space-x-2">
                    <MapPin className="w-4 h-4 text-muted-foreground" />
                    <span className="text-sm text-muted-foreground">{installation.zone}</span>
                  </div>

                  <InstallationStatusBadge status={installation.status} priority={installation.priority} />
                </div>

                <Button variant="ghost" size="sm" onClick={() => onViewInstallation(installation)}>
                  <Eye className="w-4 h-4" />
                </Button>
              </div>
            ))
          )}
        </div>
      </CardContent>
    </Card>
  )
}
