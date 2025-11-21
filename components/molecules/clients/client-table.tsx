"use client"

import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table"
import { Button } from "@/components/ui/button"
import { StatusBadge } from "@/components/atoms/status-badge"
import { Eye, Edit, Trash2 } from "lucide-react"
import type { Client } from "@/lib/mock-data"

interface ClientTableProps {
  clients: Client[]
  onViewClient: (client: Client) => void
  onEditClient: (client: Client) => void
  onDeleteClient: (client: Client) => void
}

export function ClientTable({ clients, onViewClient, onEditClient, onDeleteClient }: ClientTableProps) {
  if (clients.length === 0) {
    return (
      <div className="text-center py-12">
        <p className="text-muted-foreground">No se encontraron clientes con los filtros aplicados</p>
      </div>
    )
  }

  return (
    <div className="rounded-md border">
      <Table>
        <TableHeader>
          <TableRow>
            <TableHead>Nombre</TableHead>
            <TableHead>Cédula</TableHead>
            <TableHead>Teléfono</TableHead>
            <TableHead>Plan</TableHead>
            <TableHead>Zona</TableHead>
            <TableHead>Estado Contrato</TableHead>
            <TableHead>Equipo</TableHead>
            <TableHead className="text-right">Acciones</TableHead>
          </TableRow>
        </TableHeader>
        <TableBody>
          {clients.map((client) => (
            <TableRow key={client.id}>
              <TableCell className="font-medium">{client.fullName}</TableCell>
              <TableCell>{client.cedula}</TableCell>
              <TableCell>{client.phone}</TableCell>
              <TableCell className="text-sm">{client.plan}</TableCell>
              <TableCell>{client.zone}</TableCell>
              <TableCell>
                <StatusBadge status={client.contractStatus} variant="contract" />
              </TableCell>
              <TableCell>
                <StatusBadge status={client.equipmentInstalled} variant="equipment" />
              </TableCell>
              <TableCell className="text-right">
                <div className="flex items-center justify-end space-x-2">
                  <Button variant="ghost" size="sm" onClick={() => onViewClient(client)}>
                    <Eye className="w-4 h-4" />
                  </Button>
                  <Button variant="ghost" size="sm" onClick={() => onEditClient(client)}>
                    <Edit className="w-4 h-4" />
                  </Button>
                  <Button variant="ghost" size="sm" onClick={() => onDeleteClient(client)}>
                    <Trash2 className="w-4 h-4" />
                  </Button>
                </div>
              </TableCell>
            </TableRow>
          ))}
        </TableBody>
      </Table>
    </div>
  )
}
