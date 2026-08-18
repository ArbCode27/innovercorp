"use client";

import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { CRM_SURFACES } from "../../_lib/crm-theme";
import {
  formatPaymentAmount,
  formatPaymentDate,
  formatPaymentDateTime,
  type CrmPayment,
  type CrmPaymentStatus,
} from "../../_lib/payments";
import { StatusBadge } from "../shared/status-badge";
import { EmptyState } from "../shared/empty-state";
import { Wallet } from "lucide-react";

interface PaymentsTableProps {
  payments: CrmPayment[];
  updatingId: string | null;
  onStatusChange: (paymentId: string, status: CrmPaymentStatus) => void;
}

const REVIEW_STATUSES: Array<{ value: CrmPaymentStatus; label: string }> = [
  { value: "EN_PROCESO", label: "En proceso" },
  { value: "APROBADO", label: "Aprobado" },
  { value: "RECHAZADO", label: "Rechazado" },
];

export const PaymentsTable = ({
  payments,
  updatingId,
  onStatusChange,
}: PaymentsTableProps) => {
  if (!payments.length) {
    return (
      <div
        className={`overflow-hidden rounded-xl border ${CRM_SURFACES.border} ${CRM_SURFACES.elevated}`}>
        <EmptyState
          icon={Wallet}
          title="Sin pagos registrados"
          description="Cuando Nova registre un comprobante, aparecerá aquí."
        />
      </div>
    );
  }

  return (
    <div
      className={`overflow-hidden rounded-xl border ${CRM_SURFACES.border} ${CRM_SURFACES.elevated}`}>
      <div className="overflow-x-auto">
        <Table className="min-w-[980px]">
          <TableHeader>
            <TableRow className={`${CRM_SURFACES.border} hover:bg-transparent`}>
              <TableHead className={CRM_SURFACES.textMuted}>Fecha</TableHead>
              <TableHead className={CRM_SURFACES.textMuted}>Cliente</TableHead>
              <TableHead className={CRM_SURFACES.textMuted}>Cédula</TableHead>
              <TableHead className={CRM_SURFACES.textMuted}>Monto</TableHead>
              <TableHead className={CRM_SURFACES.textMuted}>Banco</TableHead>
              <TableHead className={CRM_SURFACES.textMuted}>Referencia</TableHead>
              <TableHead className={CRM_SURFACES.textMuted}>Estado</TableHead>
              <TableHead className={CRM_SURFACES.textMuted}>Revisión</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {payments.map((payment) => {
              const isUpdating = updatingId === payment.id;
              const canReview =
                payment.status === "EN_PROCESO" ||
                payment.status === "APROBADO" ||
                payment.status === "RECHAZADO";

              return (
                <TableRow
                  key={payment.id}
                  className={`${CRM_SURFACES.border} ${CRM_SURFACES.hover}`}>
                  <TableCell>
                    <div className={CRM_SURFACES.textPrimary}>
                      {formatPaymentDate(payment.payment_date)}
                    </div>
                    <div className={`text-[11px] ${CRM_SURFACES.textMuted}`}>
                      {formatPaymentDateTime(payment.created_at)}
                    </div>
                  </TableCell>
                  <TableCell>
                    <div className={`font-medium ${CRM_SURFACES.textPrimary}`}>
                      {payment.client_name}
                    </div>
                    {payment.comment ? (
                      <div className={`max-w-48 truncate text-[11px] ${CRM_SURFACES.textMuted}`}>
                        {payment.comment}
                      </div>
                    ) : null}
                  </TableCell>
                  <TableCell className={`font-mono ${CRM_SURFACES.textSecondary}`}>
                    {payment.cedula}
                  </TableCell>
                  <TableCell className={`font-medium ${CRM_SURFACES.textPrimary}`}>
                    {formatPaymentAmount(Number(payment.amount))}
                  </TableCell>
                  <TableCell className={CRM_SURFACES.textSecondary}>
                    {payment.bank}
                  </TableCell>
                  <TableCell className={`font-mono ${CRM_SURFACES.textMuted}`}>
                    {payment.transaction_code}
                  </TableCell>
                  <TableCell>
                    <StatusBadge status={payment.status} />
                  </TableCell>
                  <TableCell>
                    {canReview ? (
                      <Select
                        value={payment.status}
                        disabled={isUpdating}
                        onValueChange={(value) =>
                          onStatusChange(payment.id, value as CrmPaymentStatus)
                        }>
                        <SelectTrigger
                          className={`h-8 w-[140px] ${CRM_SURFACES.border} ${CRM_SURFACES.input}`}
                          aria-label={`Cambiar estado del pago de ${payment.client_name}`}>
                          <SelectValue />
                        </SelectTrigger>
                        <SelectContent>
                          {REVIEW_STATUSES.map((item) => (
                            <SelectItem key={item.value} value={item.value}>
                              {item.label}
                            </SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                    ) : (
                      <span className={`text-xs ${CRM_SURFACES.textMuted}`}>—</span>
                    )}
                  </TableCell>
                </TableRow>
              );
            })}
          </TableBody>
        </Table>
      </div>
    </div>
  );
};
