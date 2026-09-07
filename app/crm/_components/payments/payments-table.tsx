"use client";

import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { CRM_SURFACES, CRM_TABLE } from "../../_lib/crm-theme";
import {
  buildWhatsAppMeUrl,
  canRejectPayment,
  formatPaymentAmount,
  formatPaymentDate,
  formatPaymentDateTime,
  formatPaymentField,
  isPaymentReadyForApproval,
  PAYMENT_PENDING_LABEL,
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

const PaymentValue = ({
  value,
  className,
}: {
  value: string;
  className?: string;
}) => (
  <span
    className={
      value === PAYMENT_PENDING_LABEL
        ? `${CRM_SURFACES.textMuted} italic`
        : className
    }>
    {value}
  </span>
);

const WhatsAppIcon = ({ className }: { className?: string }) => (
  <svg
    viewBox="0 0 24 24"
    fill="currentColor"
    className={className}
    aria-hidden="true">
    <path d="M17.472 14.382c-.297-.149-1.758-.867-2.03-.967-.273-.099-.471-.148-.67.15-.197.297-.767.966-.94 1.164-.173.199-.347.223-.644.075-.297-.15-1.255-.463-2.39-1.475-.883-.788-1.48-1.761-1.653-2.059-.173-.297-.018-.458.13-.606.134-.133.298-.347.446-.52.149-.174.198-.298.298-.497.099-.198.05-.371-.025-.52-.075-.149-.669-1.612-.916-2.207-.242-.579-.487-.5-.669-.51-.173-.008-.371-.01-.57-.01-.198 0-.52.074-.792.372-.272.297-1.04 1.016-1.04 2.479 0 1.462 1.065 2.875 1.213 3.074.149.198 2.096 3.2 5.077 4.487.709.306 1.262.489 1.694.625.712.227 1.36.195 1.871.118.571-.085 1.758-.719 2.006-1.413.248-.694.248-1.289.173-1.413-.074-.124-.272-.198-.57-.347m-5.421 7.403h-.004a9.87 9.87 0 01-5.031-1.378l-.361-.214-3.741.982.998-3.648-.235-.374a9.86 9.86 0 01-1.51-5.26c.001-5.45 4.436-9.884 9.888-9.884 2.64 0 5.122 1.03 6.988 2.898a9.825 9.825 0 012.893 6.994c-.003 5.45-4.435 9.884-9.885 9.884m8.413-18.297A11.815 11.815 0 0012.05 0C5.495 0 .16 5.335.157 11.892c0 2.096.547 4.142 1.588 5.945L.057 24l6.305-1.654a11.882 11.882 0 005.683 1.448h.005c6.554 0 11.89-5.335 11.893-11.893a11.821 11.821 0 00-3.48-8.413z" />
  </svg>
);

export const PaymentsTable = ({
  payments,
  updatingId,
  onApprove,
  onReject,
}: PaymentsTableProps) => {
  if (!payments.length) {
    return (
      <div className={CRM_TABLE}>
        <EmptyState
          icon={Wallet}
          title="Sin comprobantes"
          description="Cuando un asesor o Nova registre un comprobante, aparecerá aquí aunque falten datos."
        />
      </div>
    );
  }

  return (
    <div className={`overflow-hidden ${CRM_TABLE}`}>
      <div className="overflow-x-auto">
        <Table className="min-w-[1080px]">
          <TableHeader>
            <TableRow className={`${CRM_SURFACES.border} hover:bg-transparent`}>
              <TableHead className={CRM_SURFACES.textMuted}>Fecha</TableHead>
              <TableHead className={CRM_SURFACES.textMuted}>Cliente</TableHead>
              <TableHead className={CRM_SURFACES.textMuted}>Cédula</TableHead>
              <TableHead className={CRM_SURFACES.textMuted}>Monto</TableHead>
              <TableHead className={CRM_SURFACES.textMuted}>Banco</TableHead>
              <TableHead className={CRM_SURFACES.textMuted}>Referencia</TableHead>
              <TableHead className={CRM_SURFACES.textMuted}>Factura</TableHead>
              <TableHead className={CRM_SURFACES.textMuted}>Estado</TableHead>
              <TableHead className={CRM_SURFACES.textMuted}>Revisión</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {payments.map((payment) => {
              const isUpdating = updatingId === payment.id;
              const clientName = formatPaymentField(payment.client_name);
              const canReject = canRejectPayment(payment);
              const canApprove = isPaymentReadyForApproval(payment);
              const approveHint = canApprove
                ? `Aprobar pago de ${clientName}`
                : "Faltan datos para aprobar este comprobante";
              const latestInvoiceDate = payment.latest_invoice_date?.trim()
                ? formatPaymentDate(payment.latest_invoice_date)
                : "—";
              const whatsappUrl = buildWhatsAppMeUrl(payment.phone_id);

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
                      <PaymentValue value={clientName} />
                    </div>
                    {payment.comment ? (
                      <div
                        className={`max-w-48 truncate text-[11px] ${CRM_SURFACES.textMuted}`}>
                        {payment.comment}
                      </div>
                    ) : null}
                  </TableCell>
                  <TableCell
                    className={`font-mono ${CRM_SURFACES.textSecondary}`}>
                    <PaymentValue value={formatPaymentField(payment.cedula)} />
                  </TableCell>
                  <TableCell
                    className={`font-medium ${CRM_SURFACES.textPrimary}`}>
                    <PaymentValue value={formatPaymentAmount(payment.amount)} />
                  </TableCell>
                  <TableCell className={CRM_SURFACES.textSecondary}>
                    <PaymentValue value={formatPaymentField(payment.bank)} />
                  </TableCell>
                  <TableCell className={`font-mono ${CRM_SURFACES.textMuted}`}>
                    <PaymentValue
                      value={formatPaymentField(payment.transaction_code)}
                    />
                  </TableCell>
                  <TableCell>
                    <div
                      className={
                        latestInvoiceDate === "—"
                          ? CRM_SURFACES.textMuted
                          : CRM_SURFACES.textPrimary
                      }
                      title="Fecha de la factura pendiente más reciente">
                      {latestInvoiceDate}
                    </div>
                  </TableCell>
                  <TableCell>
                    <StatusBadge status={payment.status} />
                  </TableCell>
                  <TableCell>
                    <div className="flex flex-wrap items-center gap-2">
                      {whatsappUrl ? (
                        <CrmButton
                          type="button"
                          size="icon"
                          variant="ghost"
                          asChild
                          className="size-8 text-emerald-600 hover:bg-emerald-50 hover:text-emerald-700 dark:text-emerald-400 dark:hover:bg-emerald-950/50 dark:hover:text-emerald-300"
                          title={`Abrir WhatsApp de ${clientName}`}
                          aria-label={`Abrir WhatsApp de ${clientName}`}>
                          <a
                            href={whatsappUrl}
                            target="_blank"
                            rel="noopener noreferrer">
                            <WhatsAppIcon className="size-4" />
                          </a>
                        </CrmButton>
                      ) : (
                        <CrmButton
                          type="button"
                          size="icon"
                          variant="ghost"
                          disabled
                          className="size-8"
                          title="Sin número de WhatsApp en este pago"
                          aria-label="Sin número de WhatsApp en este pago">
                          <WhatsAppIcon className="size-4 opacity-40" />
                        </CrmButton>
                      )}

                      {canReject ? (
                        <>
                          <CrmButton
                            type="button"
                            size="sm"
                            variant="success"
                            disabled={isUpdating || !canApprove}
                            title={approveHint}
                            onClick={() => onApprove(payment.id)}
                            aria-label={approveHint}>
                            <CheckCircle2
                              className="size-4"
                              aria-hidden="true"
                            />
                            Aprobar
                          </CrmButton>
                          <CrmButton
                            type="button"
                            size="sm"
                            variant="danger"
                            disabled={isUpdating}
                            onClick={() => onReject(payment.id)}
                            aria-label={`Rechazar pago de ${clientName}`}>
                            <XCircle className="size-4" aria-hidden="true" />
                            Rechazar
                          </CrmButton>
                        </>
                      ) : (
                        <span className={`text-xs ${CRM_SURFACES.textMuted}`}>
                          Sin acciones
                        </span>
                      )}
                    </div>
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
