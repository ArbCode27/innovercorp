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
import { Check, Trash2, X } from "lucide-react";
import { Payment } from "@/types/payments";
import { useState } from "react";
import {
  approvePayment,
  deletePayment,
  updateStatusPayment,
} from "@/actions/API/payments";
import { useRouter } from "next/navigation";

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

  const router = useRouter();
  const [loading, setLoading] = useState(false);

  const sendPaymentApprove = async (
    id: string,
    data: {
      client_id: string;
      amount: string;
      payment_date: string;
      transaction_code: string;
    }
  ) => {
    setLoading(true);
    const result = await approvePayment(id, data);
    console.log(result);
    if (result.data) {
      setLoading(false);
      router.refresh();
    }
  };

  const changePaymentStatus = async (id: string[], accepted: boolean) => {
    setLoading(true);
    const result = await updateStatusPayment(id, accepted);
    console.log(result);
    if (result.count) {
      setLoading(false);
      router.refresh();
    }
  };

  const deletePaymentTable = async (id: string) => {
    setLoading(true);
    const result = await deletePayment(id);
    console.log(result);
    if (result.id) {
      setLoading(false);
      router.refresh();
    }
  };

  return (
    <div className="rounded-md border relative">
      <Table>
        {loading && (
          <div className="backdrop-blur-md bg-white/30 border border-white/20 rounded-xl shadow-lg p-6 absolute w-full h-full flex items-center justify-center">
            Cargando...
          </div>
        )}
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
                {client.status !== "APROBADO" && (
                  <Button
                    onClick={() =>
                      sendPaymentApprove(client.id, {
                        client_id: client.client_id,
                        payment_date: client.payment_date,
                        transaction_code: client.transaction_code,
                        amount: client.amount,
                      })
                    }
                    className="bg-green-400 hover:bg-green-400 cursor-pointer"
                  >
                    <Check />
                  </Button>
                )}

                {client.status === "EN_PROCESO" && (
                  <Button
                    onClick={() => {
                      changePaymentStatus([client.id], false);
                    }}
                    className="bg-red-500 hover:bg-red-500 cursor-pointer"
                  >
                    <X />
                  </Button>
                )}

                {client.status !== "EN_PROCESO" && (
                  <Button
                    onClick={() => deletePaymentTable(client.id)}
                    className="bg-red-500 hover:bg-red-500 cursor-pointer"
                  >
                    <Trash2 />
                  </Button>
                )}
              </TableCell>
            </TableRow>
          ))}
        </TableBody>
      </Table>
    </div>
  );
}
