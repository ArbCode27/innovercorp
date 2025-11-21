"use client";

import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { Button } from "@/components/ui/button";
import { StatusBadge } from "@/components/atoms/status-badge";
import { Check, X } from "lucide-react";
import { Payment } from "@/types/payments";

interface ClientTableProps {
  payments: Payment[];
  onViewClient: (client: Payment) => void;
  onEditClient: (client: Payment) => void;
  onDeleteClient: (client: Payment) => void;
}

export function PaymentTable({
  payments,
  onViewClient,
  onEditClient,
  onDeleteClient,
}: ClientTableProps) {
  if (payments.length === 0) {
    return (
      <div className="text-center py-12">
        <p className="text-muted-foreground">
          No se encontraron clientes con los filtros aplicados
        </p>
      </div>
    );
  }

  return (
    <div className="rounded-md border">
      <Table>
        <TableHeader>
          <TableRow>
            <TableHead>Nombre</TableHead>
            <TableHead>Monto</TableHead>
            <TableHead>Banco</TableHead>
            <TableHead>codigo</TableHead>
            <TableHead>Estado</TableHead>
            <TableHead className="text-right">Confirmar Pago</TableHead>
          </TableRow>
        </TableHeader>
        <TableBody>
          {payments.map((client) => (
            <TableRow key={client.id}>
              <TableCell className="font-medium">{client.name}</TableCell>
              <TableCell className="text-sm">{client.amount}</TableCell>
              <TableCell className="text-sm">{client.bank}</TableCell>
              <TableCell>{client.transaction_code}</TableCell>
              <TableCell>
                <StatusBadge status={client.status!} variant="contract" />
              </TableCell>
              <TableCell className="text-right space-x-2">
                <Button className="bg-green-400 hover:bg-green-400">
                  <Check />
                </Button>
                <Button className="bg-red-500 hover:bg-red-500">
                  <X />
                </Button>
              </TableCell>
            </TableRow>
          ))}
        </TableBody>
      </Table>
    </div>
  );
}
