"use client";

import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { CRM_SURFACES } from "../../_lib/crm-theme";
import {
  formatPaymentAmount,
  formatPaymentDate,
  formatPaymentDateTime,
  type CrmPayment,
} from "../../_lib/payments";
import { StatusBadge } from "../shared/status-badge";
import { EmptyState } from "../shared/empty-state";
import { CheckCircle2, Wallet, XCircle } from "lucide-react";
import { CrmButton } from "../shared/crm-button";

interface PaymentsTableProps {
  payments: CrmPayment[];
  updatingId: string | null;
  onApprove: (paymentId: string) => void;
  onReject: (paymentId: string) => void;
}

export const PaymentsTable = ({
  payments,
  updatingId,
  onApprove,
  onReject,
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
                payment.status === "EN_PROCESO" || payment.status === "ERROR";

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
                      <div className="flex flex-wrap items-center gap-2">
                        <CrmButton
                          type="button"
                          size="sm"
                          variant="success"
                          disabled={isUpdating}
                          onClick={() => onApprove(payment.id)}
                          aria-label={`Aprobar pago de ${payment.client_name}`}>
                          <CheckCircle2 className="size-4" aria-hidden="true" />
                          Aprobar
                        </CrmButton>
                        <CrmButton
                          type="button"
                          size="sm"
                          variant="danger"
                          disabled={isUpdating}
                          onClick={() => onReject(payment.id)}
                          aria-label={`Rechazar pago de ${payment.client_name}`}>
                          <XCircle className="size-4" aria-hidden="true" />
                          Rechazar
                        </CrmButton>
                      </div>
                    ) : (
                      <span className={`text-xs ${CRM_SURFACES.textMuted}`}>
                        Sin acciones
                      </span>
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
