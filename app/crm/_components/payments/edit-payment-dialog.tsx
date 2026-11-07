"use client";

import { useEffect, useMemo, useState } from "react";
import Image from "next/image";
import {
  AlertCircle,
  Building2,
  Calendar,
  Check,
  CheckCircle2,
  DollarSign,
  ExternalLink,
  Hash,
  IdCard,
  Loader2,
  MessageSquare,
  Pencil,
  Phone,
  RefreshCw,
  Sparkles,
  User,
} from "lucide-react";
import { toast } from "sonner";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Badge } from "@/components/ui/badge";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { CRM_SURFACES } from "../../_lib/crm-theme";
import type { Agent } from "../../_lib/types";
import {
  CRM_KNOWN_PAYMENT_BANKS,
  CRM_PAYMENT_STATUS_LABELS,
  CRM_PAYMENT_STATUSES,
  type CrmPayment,
  type CrmPaymentStatus,
  normalizeReceptorBank,
} from "../../_lib/payments";
import { formatBcvRate, roundMoney } from "@/app/api/crm/_lib/dolarvzla-rate";

interface EditPaymentDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  payment: CrmPayment | null;
  currentAgent?: Pick<Agent, "id" | "name"> | null;
  onPaymentUpdated: (updatedPayment: CrmPayment) => void;
}

const COMMON_BANKS = CRM_KNOWN_PAYMENT_BANKS;

const getStatusBadgeColor = (status: CrmPaymentStatus) => {
  switch (status) {
    case "APROBADO":
      return "bg-emerald-500/10 text-emerald-600 border-emerald-500/30 dark:text-emerald-400";
    case "EN_PROCESO":
      return "bg-blue-500/10 text-blue-600 border-blue-500/30 dark:text-blue-400";
    case "RECIBIDO":
      return "bg-amber-500/10 text-amber-600 border-amber-500/30 dark:text-amber-400";
    case "RECHAZADO":
    case "ERROR":
      return "bg-rose-500/10 text-rose-600 border-rose-500/30 dark:text-rose-400";
    case "DUPLICADO":
      return "bg-purple-500/10 text-purple-600 border-purple-500/30 dark:text-purple-400";
    default:
      return "bg-muted text-muted-foreground border-border";
  }
};

export const EditPaymentDialog = ({
  open,
  onOpenChange,
  payment,
  currentAgent,
  onPaymentUpdated,
}: EditPaymentDialogProps) => {
  // Form draft fields
  const [clientName, setClientName] = useState<string>("");
  const [cedula, setCedula] = useState<string>("");
  const [phone, setPhone] = useState<string>("");
  const [amount, setAmount] = useState<string>("");
  const [bank, setBank] = useState<string>("");
  const [transactionCode, setTransactionCode] = useState<string>("");
  const [paymentDate, setPaymentDate] = useState<string>("");
  const [status, setStatus] = useState<CrmPaymentStatus>("EN_PROCESO");
  const [comment, setComment] = useState<string>("");

  // Converter helper (Bs to USD)
  const [showConverter, setShowConverter] = useState<boolean>(false);
  const [amountBs, setAmountBs] = useState<string>("");
  const [bcvRate, setBcvRate] = useState<number>(0);
  const [isFetchingBcv, setIsFetchingBcv] = useState<boolean>(false);

  // Submission state
  const [isSubmitting, setIsSubmitting] = useState<boolean>(false);

  // Sync draft state with payment when opened
  useEffect(() => {
    if (!open || !payment) {
      setShowConverter(false);
      setAmountBs("");
      return;
    }

    setClientName(payment.client_name || "");
    setCedula(payment.cedula || "");
    setPhone(payment.phone_id || "");
    setAmount(payment.amount != null ? String(payment.amount) : "");
    setBank(payment.bank || "");
    setTransactionCode(payment.transaction_code || "");
    setPaymentDate(
      payment.payment_date ? payment.payment_date.slice(0, 10) : "",
    );
    setStatus(payment.status || "EN_PROCESO");
    setComment(payment.comment || "");
  }, [open, payment]);

  // Load BCV rate when converter is requested
  const handleLoadBcv = async () => {
    setIsFetchingBcv(true);
    try {
      const res = await fetch("/api/crm/bcv-rate");
      const data = await res.json();
      if (data.ok && data.rate) {
        setBcvRate(Number(data.rate));
      }
    } catch (err) {
      console.warn("[EDIT_PAYMENT_DIALOG] bcv_fetch_error", err);
    } finally {
      setIsFetchingBcv(false);
    }
  };

  const handleToggleConverter = () => {
    if (!showConverter && bcvRate === 0) {
      void handleLoadBcv();
    }
    setShowConverter((prev) => !prev);
  };

  const handleApplyBsConversion = () => {
    if (!amountBs || bcvRate <= 0) return;
    const cleanBs = Number.parseFloat(
      amountBs.replace(/\./g, "").replace(",", "."),
    );
    if (!Number.isFinite(cleanBs) || cleanBs <= 0) {
      toast.error("Ingresa un monto en Bs válido");
      return;
    }
    const calculatedUsd = roundMoney(cleanBs / bcvRate);
    setAmount(String(calculatedUsd));
    toast.success(`Monto calculado: $${calculatedUsd.toFixed(2)} USD`);
  };

  // Image preview resolution
  const receiptImageUrl = useMemo(() => {
    if (!payment) return null;
    if (payment.receipt_media_url) return payment.receipt_media_url;
    const meta = payment.receipt_metadata;
    if (meta && typeof meta === "object") {
      if (typeof meta.media_url === "string" && meta.media_url.trim()) {
        return meta.media_url.trim();
      }
      if (typeof meta.receipt_url === "string" && meta.receipt_url.trim()) {
        return meta.receipt_url.trim();
      }
    }
    return null;
  }, [payment]);

  // Dirty state checking
  const isDirty = useMemo(() => {
    if (!payment) return false;

    const origClientName = (payment.client_name || "").trim();
    const origCedula = (payment.cedula || "").trim();
    const origPhone = (payment.phone_id || "").trim();
    const origBank = (payment.bank || "").trim();
    const origRef = (payment.transaction_code || "").trim();
    const origDate = (payment.payment_date || "").slice(0, 10);
    const origStatus = payment.status || "EN_PROCESO";
    const origComment = (payment.comment || "").trim();

    const origAmount =
      payment.amount != null ? String(Number(payment.amount)) : "";
    const currentAmount =
      amount.trim() !== "" && !Number.isNaN(Number(amount))
        ? String(Number(amount))
        : amount.trim();

    if (clientName.trim() !== origClientName) return true;
    if (cedula.trim() !== origCedula) return true;
    if (phone.trim() !== origPhone) return true;
    if (currentAmount !== origAmount) return true;
    if (bank.trim() !== origBank) return true;
    if (transactionCode.trim() !== origRef) return true;
    if (paymentDate !== origDate) return true;
    if (status !== origStatus) return true;
    if (comment.trim() !== origComment) return true;

    return false;
  }, [
    payment,
    clientName,
    cedula,
    phone,
    amount,
    bank,
    transactionCode,
    paymentDate,
    status,
    comment,
  ]);

  // Validation
  const parsedAmount = Number.parseFloat(amount);
  const isAmountValid =
    amount.trim() === "" ||
    (Number.isFinite(parsedAmount) && parsedAmount > 0);

  const isFormValid = isAmountValid && isDirty;

  const handleSubmit = async (event: React.FormEvent) => {
    event.preventDefault();
    if (!payment || !isFormValid || isSubmitting) return;

    if (!currentAgent?.id) {
      toast.error("Debes iniciar sesión como asesor para editar pagos");
      return;
    }

    setIsSubmitting(true);

    try {
      const payload = {
        id: payment.id,
        agent_id: currentAgent.id,
        client_name: clientName.trim() || null,
        cedula: cedula.trim() || null,
        phone_id: phone.trim() || null,
        amount:
          amount.trim() !== "" && Number.isFinite(parsedAmount)
            ? roundMoney(parsedAmount)
            : null,
        bank: bank.trim() || null,
        transaction_code: transactionCode.trim() || null,
        payment_date: paymentDate || undefined,
        status,
        comment: comment.trim() || null,
      };

      const response = await fetch("/api/crm/payments", {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
      });

      const data = await response.json();
      if (!response.ok || !data.ok) {
        throw new Error(data.error || "No se pudo actualizar el pago");
      }

      const updatedRecord: CrmPayment = data.payment || {
        ...payment,
        ...payload,
      };

      onPaymentUpdated(updatedRecord);
      onOpenChange(false);
    } catch (err) {
      toast.error(
        err instanceof Error
          ? err.message
          : "Ocurrió un error al guardar los cambios",
      );
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent
        className={`max-h-[92vh] w-[95vw] ${
          receiptImageUrl ? "max-w-4xl" : "max-w-2xl"
        } overflow-y-auto p-0 ${CRM_SURFACES.elevatedTranslucent} ${
          CRM_SURFACES.border
        }`}>
        <form onSubmit={handleSubmit} noValidate>
          {/* Header */}
          <DialogHeader className={`border-b p-5 ${CRM_SURFACES.border}`}>
            <div className="flex flex-wrap items-center justify-between gap-3 pr-6">
              <div className="flex items-center gap-2.5">
                <div className="flex size-9 items-center justify-center rounded-xl bg-sky-500/10 text-sky-600 dark:text-sky-400">
                  <Pencil className="size-4" aria-hidden="true" />
                </div>
                <div>
                  <DialogTitle className="text-base font-semibold text-foreground">
                    Editar Comprobante de Pago
                  </DialogTitle>
                  <DialogDescription className="text-xs text-muted-foreground">
                    Corrige o actualiza los datos del pago registrado en el CRM.
                  </DialogDescription>
                </div>
              </div>

              {/* Status Badge */}
              <Badge
                variant="outline"
                className={`font-medium ${getStatusBadgeColor(status)}`}>
                {CRM_PAYMENT_STATUS_LABELS[status] || status}
              </Badge>
            </div>
          </DialogHeader>

          {/* Body Content */}
          <div
            className={`p-5 ${
              receiptImageUrl ? "grid grid-cols-1 gap-6 md:grid-cols-12" : ""
            }`}>
            {/* Left Column: Receipt Image Preview (if present) */}
            {receiptImageUrl ? (
              <div className="flex flex-col gap-3 md:col-span-5">
                <Label className="text-xs font-semibold text-muted-foreground uppercase tracking-wider">
                  Comprobante adjunto
                </Label>
                <div className="relative aspect-[3/4] w-full overflow-hidden rounded-xl border border-border/70 bg-muted/40 shadow-inner">
                  <Image
                    src={receiptImageUrl}
                    alt="Comprobante de pago"
                    fill
                    unoptimized
                    className="object-contain p-1"
                  />
                </div>
                <a
                  href={receiptImageUrl}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="inline-flex items-center justify-center gap-1.5 text-xs text-sky-600 transition-colors hover:text-sky-700 hover:underline dark:text-sky-400">
                  <ExternalLink className="size-3.5" aria-hidden="true" />
                  Abrir comprobante en tamaño completo
                </a>
              </div>
            ) : null}

            {/* Right Column (or Full Width): Editable Form Fields */}
            <div
              className={`flex flex-col gap-5 ${
                receiptImageUrl ? "md:col-span-7" : ""
              }`}>
              {/* Section 1: Cliente */}
              <div className="space-y-3 rounded-xl border border-border/60 bg-muted/20 p-3.5">
                <span className="text-[11px] font-semibold tracking-wider text-muted-foreground uppercase">
                  Datos del Cliente
                </span>

                <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
                  <div className="sm:col-span-2">
                    <Label
                      htmlFor="edit-payment-client-name"
                      className="text-xs font-medium text-foreground">
                      Nombre completo
                    </Label>
                    <div className="relative mt-1">
                      <User
                        className="pointer-events-none absolute left-3 top-2.5 size-4 text-muted-foreground"
                        aria-hidden="true"
                      />
                      <Input
                        id="edit-payment-client-name"
                        value={clientName}
                        onChange={(e) => setClientName(e.target.value)}
                        placeholder="Nombre del cliente"
                        className="pl-9 text-sm"
                        disabled={isSubmitting}
                      />
                    </div>
                  </div>

                  <div>
                    <Label
                      htmlFor="edit-payment-cedula"
                      className="text-xs font-medium text-foreground">
                      Cédula / RIF
                    </Label>
                    <div className="relative mt-1">
                      <IdCard
                        className="pointer-events-none absolute left-3 top-2.5 size-4 text-muted-foreground"
                        aria-hidden="true"
                      />
                      <Input
                        id="edit-payment-cedula"
                        value={cedula}
                        onChange={(e) => setCedula(e.target.value)}
                        placeholder="V12345678"
                        className="pl-9 font-mono text-sm"
                        disabled={isSubmitting}
                      />
                    </div>
                  </div>

                  <div>
                    <Label
                      htmlFor="edit-payment-phone"
                      className="text-xs font-medium text-foreground">
                      Teléfono / WhatsApp
                    </Label>
                    <div className="relative mt-1">
                      <Phone
                        className="pointer-events-none absolute left-3 top-2.5 size-4 text-muted-foreground"
                        aria-hidden="true"
                      />
                      <Input
                        id="edit-payment-phone"
                        value={phone}
                        onChange={(e) => setPhone(e.target.value)}
                        placeholder="04141234567"
                        className="pl-9 font-mono text-sm"
                        disabled={isSubmitting}
                      />
                    </div>
                  </div>
                </div>
              </div>

              {/* Section 2: Detalles del Pago */}
              <div className="space-y-3.5 rounded-xl border border-border/60 bg-muted/20 p-3.5">
                <div className="flex items-center justify-between">
                  <span className="text-[11px] font-semibold tracking-wider text-muted-foreground uppercase">
                    Detalles del Pago
                  </span>

                  {/* Bs Converter Toggle */}
                  <button
                    type="button"
                    onClick={handleToggleConverter}
                    className="inline-flex items-center gap-1 text-[11px] font-medium text-sky-600 transition-colors hover:text-sky-700 dark:text-sky-400">
                    <Sparkles className="size-3" aria-hidden="true" />
                    {showConverter
                      ? "Ocultar conversor Bs"
                      : "Calcular desde Bs"}
                  </button>
                </div>

                {/* Optional Bs Converter Box */}
                {showConverter ? (
                  <div className="space-y-2 rounded-lg border border-sky-500/20 bg-sky-500/5 p-3 text-xs">
                    <div className="flex items-center justify-between">
                      <span className="font-semibold text-foreground">
                        Conversión desde Bolívares (Bs)
                      </span>
                      <span className="text-[11px] text-muted-foreground">
                        Tasa BCV:{" "}
                        <strong className="text-foreground">
                          {bcvRate > 0 ? formatBcvRate(bcvRate) : "Cargando…"}
                        </strong>
                      </span>
                    </div>

                    <div className="flex items-center gap-2">
                      <Input
                        placeholder="Monto en Bs (ej. 2500)"
                        value={amountBs}
                        onChange={(e) => setAmountBs(e.target.value)}
                        className="h-8 text-xs"
                      />
                      <Button
                        type="button"
                        size="sm"
                        variant="secondary"
                        onClick={handleApplyBsConversion}
                        disabled={isFetchingBcv || !amountBs}
                        className="h-8 text-xs">
                        Aplicar USD
                      </Button>
                    </div>
                  </div>
                ) : null}

                <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
                  {/* Amount USD */}
                  <div>
                    <Label
                      htmlFor="edit-payment-amount"
                      className="text-xs font-medium text-foreground">
                      Monto (USD)
                    </Label>
                    <div className="relative mt-1">
                      <DollarSign
                        className="pointer-events-none absolute left-3 top-2.5 size-4 text-emerald-600 dark:text-emerald-400"
                        aria-hidden="true"
                      />
                      <Input
                        id="edit-payment-amount"
                        type="number"
                        step="any"
                        min="0"
                        value={amount}
                        onChange={(e) => setAmount(e.target.value)}
                        placeholder="25.00"
                        className={`pl-9 text-sm font-semibold ${
                          !isAmountValid
                            ? "border-destructive focus-visible:ring-destructive/30"
                            : ""
                        }`}
                        aria-invalid={!isAmountValid}
                        aria-describedby="edit-payment-amount-error"
                        disabled={isSubmitting}
                      />
                    </div>
                    {!isAmountValid ? (
                      <p
                        id="edit-payment-amount-error"
                        className="mt-1 text-[11px] text-destructive flex items-center gap-1">
                        <AlertCircle className="size-3" aria-hidden="true" />
                        Ingresa un monto positivo válido
                      </p>
                    ) : null}
                  </div>

                  {/* Payment Date */}
                  <div>
                    <Label
                      htmlFor="edit-payment-date"
                      className="text-xs font-medium text-foreground">
                      Fecha del pago
                    </Label>
                    <div className="relative mt-1">
                      <Calendar
                        className="pointer-events-none absolute left-3 top-2.5 size-4 text-muted-foreground"
                        aria-hidden="true"
                      />
                      <Input
                        id="edit-payment-date"
                        type="date"
                        value={paymentDate}
                        onChange={(e) => setPaymentDate(e.target.value)}
                        className="pl-9 text-sm"
                        disabled={isSubmitting}
                      />
                    </div>
                  </div>

                  {/* Reference / Transaction Code */}
                  <div className="sm:col-span-2">
                    <Label
                      htmlFor="edit-payment-ref"
                      className="text-xs font-medium text-foreground">
                      Referencia / Código de transacción
                    </Label>
                    <div className="relative mt-1">
                      <Hash
                        className="pointer-events-none absolute left-3 top-2.5 size-4 text-muted-foreground"
                        aria-hidden="true"
                      />
                      <Input
                        id="edit-payment-ref"
                        value={transactionCode}
                        onChange={(e) => setTransactionCode(e.target.value)}
                        placeholder="ej. 12345678"
                        className="pl-9 font-mono text-sm tracking-wide uppercase"
                        disabled={isSubmitting}
                      />
                    </div>
                  </div>

                  {/* Bank Receptor */}
                  <div className="sm:col-span-2">
                    <div className="flex items-center justify-between">
                      <Label
                        htmlFor="edit-payment-bank"
                        className="text-xs font-medium text-foreground">
                        Banco receptor
                      </Label>
                      <span className="text-[11px] text-muted-foreground">
                        Selecciona o escribe el banco
                      </span>
                    </div>

                    {/* Common Bank Quick Pills */}
                    <div
                      role="group"
                      aria-label="Bancos comunes"
                      className="mt-1.5 flex flex-wrap gap-1.5">
                      {COMMON_BANKS.map((bName) => {
                        const isSelected =
                          normalizeReceptorBank(bank) ===
                          normalizeReceptorBank(bName);
                        return (
                          <button
                            key={bName}
                            type="button"
                            onClick={() => setBank(bName)}
                            disabled={isSubmitting}
                            className={`rounded-lg border px-2.5 py-1 text-xs font-medium transition-colors ${
                              isSelected
                                ? "border-primary bg-primary text-primary-foreground shadow-xs"
                                : "border-border/70 bg-card text-muted-foreground hover:bg-muted/70 hover:text-foreground"
                            }`}>
                            {bName}
                          </button>
                        );
                      })}
                    </div>

                    <div className="relative mt-2">
                      <Building2
                        className="pointer-events-none absolute left-3 top-2.5 size-4 text-muted-foreground"
                        aria-hidden="true"
                      />
                      <Input
                        id="edit-payment-bank"
                        value={bank}
                        onChange={(e) => setBank(e.target.value)}
                        placeholder="Nombre del banco receptor"
                        className="pl-9 text-sm"
                        disabled={isSubmitting}
                      />
                    </div>
                  </div>
                </div>
              </div>

              {/* Section 3: Estado y Observaciones */}
              <div className="space-y-3 rounded-xl border border-border/60 bg-muted/20 p-3.5">
                <span className="text-[11px] font-semibold tracking-wider text-muted-foreground uppercase">
                  Estado y Observaciones
                </span>

                <div>
                  <Label
                    htmlFor="edit-payment-status"
                    className="text-xs font-medium text-foreground">
                    Estado en el CRM
                  </Label>
                  <div className="mt-1">
                    <Select
                      value={status}
                      onValueChange={(val) => setStatus(val as CrmPaymentStatus)}
                      disabled={isSubmitting}>
                      <SelectTrigger
                        id="edit-payment-status"
                        className="w-full text-sm">
                        <SelectValue placeholder="Seleccionar estado" />
                      </SelectTrigger>
                      <SelectContent>
                        {CRM_PAYMENT_STATUSES.map((st) => (
                          <SelectItem key={st} value={st}>
                            <div className="flex items-center gap-2">
                              <span
                                className={`size-2 rounded-full ${
                                  st === "APROBADO"
                                    ? "bg-emerald-500"
                                    : st === "EN_PROCESO"
                                      ? "bg-blue-500"
                                      : st === "RECIBIDO"
                                        ? "bg-amber-500"
                                        : "bg-rose-500"
                                }`}
                                aria-hidden="true"
                              />
                              <span>
                                {CRM_PAYMENT_STATUS_LABELS[st] || st}
                              </span>
                            </div>
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>
                </div>

                <div>
                  <Label
                    htmlFor="edit-payment-comment"
                    className="text-xs font-medium text-foreground">
                    Observaciones internas
                  </Label>
                  <Textarea
                    id="edit-payment-comment"
                    value={comment}
                    onChange={(e) => setComment(e.target.value)}
                    placeholder="Nota sobre correcciones o detalles adicionales..."
                    className="mt-1 h-20 resize-none text-xs"
                    disabled={isSubmitting}
                  />
                </div>
              </div>
            </div>
          </div>

          {/* Footer Actions */}
          <DialogFooter
            className={`border-t p-4 flex flex-wrap items-center justify-between gap-3 ${CRM_SURFACES.border}`}>
            <div className="text-xs text-muted-foreground">
              {isDirty ? (
                <span className="inline-flex items-center gap-1.5 text-amber-600 dark:text-amber-400 font-medium">
                  <span className="size-2 rounded-full bg-amber-500 animate-pulse" />
                  Cambios pendientes por guardar
                </span>
              ) : (
                <span>Sin cambios pendientes</span>
              )}
            </div>

            <div className="flex items-center gap-2">
              <Button
                type="button"
                variant="secondary"
                disabled={isSubmitting}
                onClick={() => onOpenChange(false)}>
                Cancelar
              </Button>

              <Button
                type="submit"
                variant="default"
                disabled={!isFormValid || isSubmitting}
                className="gap-1.5">
                {isSubmitting ? (
                  <>
                    <Loader2 className="size-4 animate-spin" aria-hidden="true" />
                    Guardando…
                  </>
                ) : (
                  <>
                    <Check className="size-4" aria-hidden="true" />
                    Guardar cambios
                  </>
                )}
              </Button>
            </div>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
};
