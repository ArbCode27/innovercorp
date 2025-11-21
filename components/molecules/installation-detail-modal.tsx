"use client"

import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from "@/components/ui/dialog"
import { Button } from "@/components/ui/button"
import { Badge } from "@/components/ui/badge"
import { InstallationStatusBadge } from "@/components/atoms/installation-status-badge"
import type { Installation } from "@/lib/installation-data"
import { User, Phone, MapPin, Calendar, Clock, Wrench, AlertTriangle, Edit } from "lucide-react"

interface InstallationDetailModalProps {
  installation: Installation | null
  isOpen: boolean
  onClose: () => void
  onEdit?: (installation: Installation) => void
}

export function InstallationDetailModal({ installation, isOpen, onClose, onEdit }: InstallationDetailModalProps) {
  if (!installation) return null

  const formatDate = (dateString: string) => {
    return new Date(dateString).toLocaleDateString("es-ES", {
      weekday: "long",
      year: "numeric",
      month: "long",
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
    <Dialog open={isOpen} onOpenChange={onClose}>
      <DialogContent className="max-w-2xl">
        <DialogHeader>
          <DialogTitle className="flex items-center justify-between">
            <div className="flex items-center space-x-2">
              <Wrench className="w-5 h-5 text-primary" />
              <span>Detalles de Instalación</span>
            </div>
            {onEdit && (
              <Button variant="outline" size="sm" onClick={() => onEdit(installation)}>
                <Edit className="w-4 h-4 mr-2" />
                Editar
              </Button>
            )}
          </DialogTitle>
          <DialogDescription>Instalación programada para {installation.clientName}</DialogDescription>
        </DialogHeader>

        <div className="space-y-6">
          {/* Status and Priority */}
          <div className="flex items-center justify-between">
            <InstallationStatusBadge status={installation.status} priority={installation.priority} />
            <Badge variant="outline">{installation.zone}</Badge>
          </div>

          {/* Client Information */}
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div className="space-y-4">
              <div>
                <label className="text-sm font-medium text-muted-foreground flex items-center space-x-1">
                  <User className="w-3 h-3" />
                  <span>Cliente</span>
                </label>
                <p className="text-foreground font-medium">{installation.clientName}</p>
              </div>
              <div>
                <label className="text-sm font-medium text-muted-foreground flex items-center space-x-1">
                  <Phone className="w-3 h-3" />
                  <span>Teléfono</span>
                </label>
                <p className="text-foreground">{installation.clientPhone}</p>
              </div>
              <div>
                <label className="text-sm font-medium text-muted-foreground flex items-center space-x-1">
                  <MapPin className="w-3 h-3" />
                  <span>Dirección</span>
                </label>
                <p className="text-foreground">{installation.address}</p>
              </div>
            </div>

            <div className="space-y-4">
              <div>
                <label className="text-sm font-medium text-muted-foreground flex items-center space-x-1">
                  <Calendar className="w-3 h-3" />
                  <span>Fecha</span>
                </label>
                <p className="text-foreground">{formatDate(installation.date)}</p>
              </div>
              <div>
                <label className="text-sm font-medium text-muted-foreground flex items-center space-x-1">
                  <Clock className="w-3 h-3" />
                  <span>Hora</span>
                </label>
                <p className="text-foreground">{formatTime(installation.time)}</p>
              </div>
              {installation.technician && (
                <div>
                  <label className="text-sm font-medium text-muted-foreground">Técnico Asignado</label>
                  <p className="text-foreground">{installation.technician}</p>
                </div>
              )}
            </div>
          </div>

          {/* Equipment Information */}
          <div className="border-t pt-6">
            <h3 className="text-lg font-semibold text-foreground mb-4 flex items-center space-x-2">
              <Wrench className="w-5 h-5 text-primary" />
              <span>Información del Equipo</span>
            </h3>
            <div>
              <label className="text-sm font-medium text-muted-foreground">Tipo de Equipo</label>
              <p className="text-foreground font-medium">{installation.equipmentType}</p>
            </div>
          </div>

          {/* Notes */}
          {installation.notes && (
            <div className="border-t pt-6">
              <label className="text-sm font-medium text-muted-foreground flex items-center space-x-1">
                <AlertTriangle className="w-3 h-3" />
                <span>Notas</span>
              </label>
              <p className="text-foreground mt-1 p-3 bg-muted/50 rounded-lg">{installation.notes}</p>
            </div>
          )}

          {/* Action Buttons */}
          <div className="border-t pt-6 flex justify-end space-x-2">
            <Button variant="outline" onClick={onClose}>
              Cerrar
            </Button>
            {installation.status === "Programada" && (
              <>
                <Button variant="outline">Reprogramar</Button>
                <Button>Marcar en Progreso</Button>
              </>
            )}
            {installation.status === "En Progreso" && <Button>Marcar Completada</Button>}
          </div>
        </div>
      </DialogContent>
    </Dialog>
  )
}
