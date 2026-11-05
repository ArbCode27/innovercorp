"use client";

import { useState } from "react";
import { Card } from "@/components/ui/card";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import { CRM_SURFACES } from "../../_lib/crm-theme";
import {
  canRejectPayment,
  formatPaymentAmount,
  formatPaymentAmountDisplay,
  formatPaymentDate,
  formatPaymentDateTime,
  formatPaymentField,
  formatPlanAmountLabel,
  getPaymentApprovedAt,
  isPaymentReadyForApproval,
  isPaymentReadyForManualApproval,
  PAYMENT_PENDING_LABEL,
  type CrmPayment,
} from "../../_lib/payments";
import { StatusBadge } from "../shared/status-badge";
import { EmptyState } from "../shared/empty-state";
import { CheckCircle2, ClipboardCheck, MessageCircle, Wallet, XCircle } from "lucide-react";
import { Button } from "@/components/ui/button";

interface PaymentsTableProps {
  payments: CrmPayment[];
  updatingId: string | null;
  onApprove: (paymentId: string) => void;
  onApproveManual?: (paymentId: string) => void;
  onReject: (paymentId: string) => void;
  onOpenChat?: (conversationId: number) => void;
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

export const PaymentsTable = ({
  payments,
  updatingId,
  onApprove,
  onApproveManual,
  onReject,
  onOpenChat,
}: PaymentsTableProps) => {
  const [paymentForManualApproval, setPaymentForManualApproval] =
    useState<CrmPayment | null>(null);

  const handleOpenManualApproval = (payment: CrmPayment) => {
    setPaymentForManualApproval(payment);
  };

  const handleConfirmManualApproval = () => {
    if (!paymentForManualApproval || !onApproveManual) return;
    const paymentId = paymentForManualApproval.id;
    setPaymentForManualApproval(null);
    onApproveManual(paymentId);
  };

  if (!payments.length) {
    return (
      <Card className="overflow-hidden py-0">
        <EmptyState
          icon={Wallet}
          title="Sin comprobantes"
          description="Cuando un asesor o Nova registre un comprobante, aparecerá aquí aunque falten datos."
        />
      </Card>
    );
  }

  return (
    <Card className="overflow-hidden py-0">
      <div className="overflow-x-auto">
        <Table className="min-w-[1280px]">
          <TableHeader>
            <TableRow className={`${CRM_SURFACES.border} hover:bg-transparent`}>
              <TableHead className={CRM_SURFACES.textMuted}>Fecha</TableHead>
              <TableHead className={CRM_SURFACES.textMuted}>Cliente</TableHead>
              <TableHead className={CRM_SURFACES.textMuted}>Cédula</TableHead>
              <TableHead className={CRM_SURFACES.textMuted}>Monto</TableHead>
              <TableHead className={CRM_SURFACES.textMuted}>Plan</TableHead>
              <TableHead className={CRM_SURFACES.textMuted}>Banco</TableHead>
              <TableHead className={CRM_SURFACES.textMuted}>Referencia</TableHead>
              <TableHead className={CRM_SURFACES.textMuted}>Factura</TableHead>
              <TableHead className={CRM_SURFACES.textMuted}>Estado</TableHead>
              <TableHead className={CRM_SURFACES.textMuted}>F. Aprobación</TableHead>
              <TableHead className={CRM_SURFACES.textMuted}>Revisión</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {payments.map((payment) => {
              const isUpdating = updatingId === payment.id;
              const clientName = formatPaymentField(payment.client_name);
              const canReject = canRejectPayment(payment);
              const canApprove = isPaymentReadyForApproval(payment);
              const canApproveManual = isPaymentReadyForManualApproval(payment);
              const approveHint = canApprove
                ? `Aprobar pago de ${clientName}`
                : "Faltan datos para aprobar este comprobante";
              const manualApproveHint = canApproveManual
                ? `Aprobar pago de ${clientName} manualmente (sin registrar en Wispro)`
                : "Se requiere un monto válido para aprobar";
              const latestInvoiceDate = payment.latest_invoice_date?.trim()
                ? formatPaymentDate(payment.latest_invoice_date)
                : "—";
              const conversationId = Number(payment.conversation_id);
              const hasCrmChat =
                Number.isFinite(conversationId) && conversationId > 0;
              const amountDisplay = formatPaymentAmountDisplay(
                payment.amount,
                payment.expected_amount,
              );
              const planLabel = formatPlanAmountLabel(payment.plan_amount);
              const approvedAt = getPaymentApprovedAt(payment);

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
                  <TableCell className={`font-medium ${CRM_SURFACES.textPrimary}`}>
                    <div>
                      <PaymentValue value={amountDisplay.primary} />
                      {amountDisplay.secondary ? (
                        <div
                          className={`text-[11px] font-normal ${
                            amountDisplay.tone === "credit"
                              ? "text-emerald-700 dark:text-emerald-300"
                              : "text-amber-700 dark:text-amber-300"
                          }`}>
                          {amountDisplay.secondary}
                        </div>
                      ) : null}
                    </div>
                  </TableCell>
                  <TableCell className={CRM_SURFACES.textSecondary}>
                    <span
                      className={
                        planLabel === "—"
                          ? CRM_SURFACES.textMuted
                          : CRM_SURFACES.textPrimary
                      }
                      title="Costo comercial del plan contratado">
                      {planLabel}
                    </span>
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
                    {approvedAt ? (
                      <div>
                        <div className={CRM_SURFACES.textPrimary}>
                          {formatPaymentDate(approvedAt)}
                        </div>
                        <div className={`text-[11px] ${CRM_SURFACES.textMuted}`}>
                          {formatPaymentDateTime(approvedAt)}
                        </div>
                      </div>
                    ) : (
                      <span className={`text-xs ${CRM_SURFACES.textMuted}`}>
                        —
                      </span>
                    )}
                  </TableCell>
                  <TableCell>
                    <div className="flex flex-wrap items-center gap-2">
                      <Button
                        type="button"
                        size="icon"
                        variant="ghost"
                        disabled={!hasCrmChat || !onOpenChat}
                        className="size-8 cursor-pointer text-emerald-600 hover:bg-emerald-50 hover:text-emerald-700 disabled:cursor-not-allowed dark:text-emerald-400 dark:hover:bg-emerald-950/50 dark:hover:text-emerald-300"
                        title={
                          hasCrmChat
                            ? `Abrir chat de ${clientName}`
                            : "Este pago no tiene chat vinculado"
                        }
                        aria-label={
                          hasCrmChat
                            ? `Abrir chat de ${clientName}`
                            : "Este pago no tiene chat vinculado"
                        }
                        onClick={() => {
                          if (!hasCrmChat || !onOpenChat) return;
                          onOpenChat(conversationId);
                        }}>
                        <MessageCircle className="size-4" aria-hidden="true" />
                      </Button>

                      {canReject ? (
                        <>
                          <Button
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
                          </Button>
                          {onApproveManual ? (
                            <Button
                              type="button"
                              size="sm"
                              variant="outline"
                              disabled={isUpdating || !canApproveManual}
                              title={manualApproveHint}
                              onClick={() => handleOpenManualApproval(payment)}
                              className="border-emerald-600/30 text-emerald-700 hover:bg-emerald-50 hover:text-emerald-800 dark:border-emerald-500/30 dark:text-emerald-400 dark:hover:bg-emerald-950/40"
                              aria-label={manualApproveHint}>
                              <ClipboardCheck
                                className="size-4 text-emerald-600 dark:text-emerald-400"
                                aria-hidden="true"
                              />
                              Manual
                            </Button>
                          ) : null}
                          <Button
                            type="button"
                            size="sm"
                            variant="destructive"
                            disabled={isUpdating}
                            onClick={() => onReject(payment.id)}
                            aria-label={`Rechazar pago de ${clientName}`}>
                            <XCircle className="size-4" aria-hidden="true" />
                            Rechazar
                          </Button>
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

      <AlertDialog
        open={paymentForManualApproval !== null}
        onOpenChange={(open) => {
          if (!open && !updatingId) {
            setPaymentForManualApproval(null);
          }
        }}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle className={CRM_SURFACES.textPrimary}>
              ¿Aprobar pago manualmente?
            </AlertDialogTitle>
            <AlertDialogDescription className={CRM_SURFACES.textMuted} asChild>
              <div className="space-y-3 text-sm">
                <p>
                  Este comprobante se marcará como{" "}
                  <strong className="text-emerald-600 dark:text-emerald-400">
                    APROBADO
                  </strong>{" "}
                  en el CRM y sumará a la métrica del total recibido por banco.
                </p>
                <div className="space-y-1 rounded-lg border bg-muted/40 p-3 text-xs">
                  <div>
                    <span className="font-semibold text-foreground">
                      Cliente:{" "}
                    </span>
                    {formatPaymentField(paymentForManualApproval?.client_name)}
                  </div>
                  <div>
                    <span className="font-semibold text-foreground">
                      Monto:{" "}
                    </span>
                    {paymentForManualApproval
                      ? formatPaymentAmount(paymentForManualApproval.amount)
                      : "—"}
                  </div>
                  <div>
                    <span className="font-semibold text-foreground">
                      Banco:{" "}
                    </span>
                    {formatPaymentField(paymentForManualApproval?.bank)}
                  </div>
                  <div>
                    <span className="font-semibold text-foreground">
                      Referencia:{" "}
                    </span>
                    {formatPaymentField(
                      paymentForManualApproval?.transaction_code,
                    )}
                  </div>
                </div>
                <p className="text-xs text-amber-600 dark:text-amber-400">
                  ⚠️ <strong>Importante:</strong> No se realizará el registro en
                  Wispro a través de la API, ya que confirmas que dicho registro
                  se realizó de forma manual en Wispro.
                </p>
              </div>
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel disabled={updatingId !== null}>
              Cancelar
            </AlertDialogCancel>
            <AlertDialogAction
              disabled={updatingId !== null}
              className="bg-emerald-600 text-white hover:bg-emerald-700 dark:bg-emerald-600 dark:hover:bg-emerald-700"
              onClick={handleConfirmManualApproval}>
              Aprobar sin Wispro
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </Card>
  );
};
