"use client"

import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from "@/components/ui/dialog"
import { Badge } from "@/components/ui/badge"
import { StatusBadge } from "@/components/atoms/status-badge"
import type { Client } from "@/lib/mock-data"
import { User, Phone, MapPin, Calendar, CreditCard, Wifi, Settings } from "lucide-react"

interface ClientDetailModalProps {
  client: Client | null
  isOpen: boolean
  onClose: () => void
}

export function ClientDetailModal({ client, isOpen, onClose }: ClientDetailModalProps) {
  if (!client) return null

  const formatDate = (dateString: string) => {
    return new Date(dateString).toLocaleDateString("es-ES", {
      year: "numeric",
      month: "long",
      day: "numeric",
    })
  }

  return (
    <Dialog open={isOpen} onOpenChange={onClose}>
      <DialogContent className="max-w-2xl">
        <DialogHeader>
          <DialogTitle className="flex items-center space-x-2">
            <User className="w-5 h-5 text-primary" />
            <span>Detalles del Cliente</span>
          </DialogTitle>
          <DialogDescription>Información completa de {client.fullName}</DialogDescription>
        </DialogHeader>

        <div className="space-y-6">
          {/* Personal Information */}
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div className="space-y-4">
              <div>
                <label className="text-sm font-medium text-muted-foreground">Nombre Completo</label>
                <p className="text-foreground font-medium">{client.fullName}</p>
              </div>
              <div>
                <label className="text-sm font-medium text-muted-foreground">Cédula</label>
                <p className="text-foreground">{client.cedula}</p>
              </div>
              <div>
                <label className="text-sm font-medium text-muted-foreground flex items-center space-x-1">
                  <Phone className="w-3 h-3" />
                  <span>Teléfono</span>
                </label>
                <p className="text-foreground">{client.phone}</p>
              </div>
              {client.email && (
                <div>
                  <label className="text-sm font-medium text-muted-foreground">Email</label>
                  <p className="text-foreground">{client.email}</p>
                </div>
              )}
            </div>

            <div className="space-y-4">
              <div>
                <label className="text-sm font-medium text-muted-foreground flex items-center space-x-1">
                  <MapPin className="w-3 h-3" />
                  <span>Dirección</span>
                </label>
                <p className="text-foreground">{client.address}</p>
              </div>
              <div>
                <label className="text-sm font-medium text-muted-foreground">Zona</label>
                <Badge variant="outline">{client.zone}</Badge>
              </div>
              <div>
                <label className="text-sm font-medium text-muted-foreground flex items-center space-x-1">
                  <Calendar className="w-3 h-3" />
                  <span>Fecha de Registro</span>
                </label>
                <p className="text-foreground">{formatDate(client.registrationDate)}</p>
              </div>
            </div>
          </div>

          {/* Service Information */}
          <div className="border-t pt-6">
            <h3 className="text-lg font-semibold text-foreground mb-4 flex items-center space-x-2">
              <Wifi className="w-5 h-5 text-primary" />
              <span>Información del Servicio</span>
            </h3>
            <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
              <div>
                <label className="text-sm font-medium text-muted-foreground flex items-center space-x-1">
                  <CreditCard className="w-3 h-3" />
                  <span>Plan Contratado</span>
                </label>
                <p className="text-foreground font-medium">{client.plan}</p>
              </div>
              <div>
                <label className="text-sm font-medium text-muted-foreground">Estado del Contrato</label>
                <div className="mt-1">
                  <StatusBadge status={client.contractStatus} variant="contract" />
                </div>
              </div>
              <div>
                <label className="text-sm font-medium text-muted-foreground flex items-center space-x-1">
                  <Settings className="w-3 h-3" />
                  <span>Equipo Instalado</span>
                </label>
                <div className="mt-1">
                  <StatusBadge status={client.equipmentInstalled} variant="equipment" />
                </div>
              </div>
            </div>
          </div>

          {/* Notes */}
          {client.notes && (
            <div className="border-t pt-6">
              <label className="text-sm font-medium text-muted-foreground">Notas</label>
              <p className="text-foreground mt-1 p-3 bg-muted/50 rounded-lg">{client.notes}</p>
            </div>
          )}
        </div>
      </DialogContent>
    </Dialog>
  )
}
