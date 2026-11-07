"use client";

import { useEffect, useState } from "react";
import Image from "next/image";
import {
  AlertCircle,
  Building2,
  Calendar,
  CheckCircle2,
  ExternalLink,
  HandCoins,
  Hash,
  Loader2,
  RefreshCw,
  Sparkles,
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
import { Badge } from "@/components/ui/badge";
import { Switch } from "@/components/ui/switch";
import { CRM_SURFACES } from "../../_lib/crm-theme";
import type { Agent, Client, Message } from "../../_lib/types";
import { formatBcvRate, roundMoney } from "@/app/api/crm/_lib/dolarvzla-rate";
import { normalizeReceptorBank } from "../../_lib/payments";

interface ManualPaymentDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  message: Message | null;
  conversationId: number;
  client: Client | null;
  currentAgent: Agent;
  onPaymentSuccess?: (paymentInfo: {
    messageId: number;
    paymentId: string;
    amountUsd: number;
    amountBs?: number;
    bank: string;
    transactionCode: string;
    registeredInWispro: boolean;
  }) => void;
}

const COMMON_BANKS = [
  { id: "Bancamiga", label: "Bancamiga" },
  { id: "Banplus", label: "Banplus" },
  { id: "Binance", label: "Binance" },
  { id: "Tarjeta de Débito", label: "Tarjeta de Débito" },
  { id: "Zelle", label: "Zelle" },
  { id: "PayPal", label: "PayPal" },
] as const;

export const ManualPaymentDialog = ({
  open,
  onOpenChange,
  message,
  conversationId,
  client,
  currentAgent,
  onPaymentSuccess,
}: ManualPaymentDialogProps) => {
  const [isExtracting, setIsExtracting] = useState(false);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [extractionSummary, setExtractionSummary] = useState<string | null>(null);
  const [confidence, setConfidence] = useState<"high" | "medium" | "low" | null>(null);

  // Form states
  const [amountBs, setAmountBs] = useState<string>("");
  const [amountUsd, setAmountUsd] = useState<string>("");
  const [bcvRate, setBcvRate] = useState<number>(0);
  const [bcvAsOf, setBcvAsOf] = useState<string>("");
  const [bank, setBank] = useState<string>("");
  const [transactionCode, setTransactionCode] = useState<string>("");
  const [paymentDate, setPaymentDate] = useState<string>("");
  const [comment, setComment] = useState<string>("");
  const [registerInWispro, setRegisterInWispro] = useState<boolean>(true);
  const [notifyClient, setNotifyClient] = useState<boolean>(true);

  const isClientLinked = Boolean(client?.wispro_id);

  // Trigger AI extraction when dialog opens with a new message
  useEffect(() => {
    if (!open || !message?.id || !message.media_url) return;

    let cancelled = false;

    const runExtraction = async () => {
      setIsExtracting(true);
      setExtractionSummary(null);
      setConfidence(null);

      try {
        const response = await fetch("/api/crm/payments/extract-receipt", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            messageId: message.id,
            conversationId,
          }),
        });

        const data = await response.json();
        if (cancelled) return;

        if (!response.ok || !data.ok) {
          throw new Error(data.error || "No se pudo interpretar el comprobante");
        }

        const ext = data.extraction;
        if (ext) {
          if (ext.amountBs) setAmountBs(String(ext.amountBs));
          if (ext.amountUsd) setAmountUsd(String(ext.amountUsd));
          if (ext.bcvRate) setBcvRate(Number(ext.bcvRate));
          if (ext.bcvAsOf) setBcvAsOf(String(ext.bcvAsOf));
          if (ext.bank) setBank(String(ext.bank));
          if (ext.transactionCode) setTransactionCode(String(ext.transactionCode));
          if (ext.paymentDate) setPaymentDate(String(ext.paymentDate));
          if (ext.confidence) setConfidence(ext.confidence);
          if (ext.summary) setExtractionSummary(ext.summary);
        }
      } catch (error) {
        if (!cancelled) {
          console.warn("[MANUAL_PAYMENT_DIALOG] extraction_error", error);
          toast.info("Ingresa los datos del comprobante manualmente");
        }
      } finally {
        if (!cancelled) {
          setIsExtracting(false);
        }
      }
    };

    runExtraction();

    return () => {
      cancelled = true;
    };
  }, [open, message?.id, message?.media_url, conversationId]);

  // Recalculate USD when Bs changes
  const handleAmountBsChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const val = e.target.value;
    setAmountBs(val);

    const numericBs = Number.parseFloat(val.replace(",", "."));
    if (Number.isFinite(numericBs) && numericBs > 0 && bcvRate > 0) {
      setAmountUsd(String(roundMoney(numericBs / bcvRate, 2)));
    }
  };

  // Recalculate Bs when USD changes
  const handleAmountUsdChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const val = e.target.value;
    setAmountUsd(val);

    const numericUsd = Number.parseFloat(val.replace(",", "."));
    if (Number.isFinite(numericUsd) && numericUsd > 0 && bcvRate > 0) {
      setAmountBs(String(roundMoney(numericUsd * bcvRate, 2)));
    }
  };

  const handleSelectBank = (selectedBank: string) => {
    setBank(selectedBank);
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();

    if (!message) return;

    const numericUsd = Number.parseFloat(amountUsd.replace(",", "."));
    if (!Number.isFinite(numericUsd) || numericUsd <= 0) {
      toast.error("Ingresa un monto válido mayor a 0");
      return;
    }

    const trimmedRef = transactionCode.trim();
    const isAlphanumericMethod = /binance|zelle|paypal/i.test(bank);
    const cleanRef = isAlphanumericMethod
      ? trimmedRef.replace(/[^a-zA-Z0-9_-]/g, "")
      : trimmedRef.replace(/\D/g, "") || trimmedRef.replace(/[^a-zA-Z0-9_-]/g, "");

    if (!cleanRef || cleanRef.length < 3) {
      toast.error("Ingresa un número de referencia válido");
      return;
    }

    if (!bank.trim()) {
      toast.error("Selecciona o escribe el banco receptor");
      return;
    }

    if (!paymentDate.trim()) {
      toast.error("Indica la fecha del pago");
      return;
    }

    if (registerInWispro && !isClientLinked) {
      toast.error("El cliente debe estar vinculado a Wispro para registrar en Wispro");
      return;
    }

    setIsSubmitting(true);

    try {
      const numericBs = amountBs
        ? Number.parseFloat(amountBs.replace(",", "."))
        : null;

      const response = await fetch("/api/crm/payments/manual-register", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          messageId: message.id,
          conversationId,
          agentId: currentAgent.id,
          amountUsd: numericUsd,
          amountBs: numericBs && Number.isFinite(numericBs) ? numericBs : null,
          bcvRate: bcvRate > 0 ? bcvRate : null,
          bank: bank.trim(),
          transactionCode: cleanRef,
          paymentDate: paymentDate.trim(),
          comment: comment.trim() || null,
          registerInWispro,
          notifyClient,
        }),
      });

      const data = await response.json();
      if (!response.ok || !data.ok) {
        throw new Error(data.error || "No se pudo registrar el pago");
      }

      toast.success(
        registerInWispro
          ? `Pago registrado y aplicado en Wispro exitosamente (Ref: ${cleanRef})`
          : `Pago guardado en bandeja del CRM para revisión (Ref: ${cleanRef})`,
      );

      onPaymentSuccess?.({
        messageId: message.id,
        paymentId: data.paymentId,
        amountUsd: numericUsd,
        amountBs: numericBs && Number.isFinite(numericBs) ? numericBs : undefined,
        bank: bank.trim(),
        transactionCode: cleanRef,
        registeredInWispro: registerInWispro,
      });

      onOpenChange(false);
    } catch (error) {
      toast.error(
        error instanceof Error ? error.message : "Error al registrar el pago",
      );
    } finally {
      setIsSubmitting(false);
    }
  };

  const imageUrl = message?.media_url;

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className={`max-h-[92vh] w-[95vw] max-w-4xl overflow-y-auto p-0 sm:max-w-3xl ${CRM_SURFACES.elevatedTranslucent} ${CRM_SURFACES.border}`}>
        <form onSubmit={handleSubmit}>
          <DialogHeader className={`border-b p-5 ${CRM_SURFACES.border}`}>
            <div className="flex items-center justify-between gap-4">
              <div>
                <DialogTitle className="flex items-center gap-2 text-base font-semibold">
                  <HandCoins className="size-5 text-emerald-500" aria-hidden="true" />
                  Registrar Pago de Comprobante
                </DialogTitle>
                <DialogDescription className="mt-1 text-xs text-muted-foreground">
                  Extracción e interpretación inteligente con IA para registro inmediato.
                </DialogDescription>
              </div>
              {isExtracting ? (
                <Badge variant="outline" className="gap-1.5 border-primary/30 bg-primary/10 text-primary">
                  <Loader2 className="size-3 animate-spin" aria-hidden="true" />
                  IA Analizando...
                </Badge>
              ) : confidence ? (
                <Badge
                  variant="outline"
                  className={`gap-1 ${
                    confidence === "high"
                      ? "border-emerald-500/30 bg-emerald-500/10 text-emerald-700 dark:text-emerald-300"
                      : "border-amber-500/30 bg-amber-500/10 text-amber-700 dark:text-amber-300"
                  }`}>
                  <Sparkles className="size-3" aria-hidden="true" />
                  Confianza: {confidence === "high" ? "Alta" : "Media"}
                </Badge>
              ) : null}
            </div>
          </DialogHeader>

          <div className="grid grid-cols-1 gap-6 p-5 md:grid-cols-12">
            {/* Left side: Image Voucher Preview */}
            <div className="flex flex-col gap-3 md:col-span-5">
              <Label className="text-xs font-medium text-muted-foreground">
                Comprobante enviado por el cliente
              </Label>
              <div className="relative aspect-[3/4] w-full overflow-hidden rounded-xl border border-border/60 bg-muted/30">
                {imageUrl ? (
                  <Image
                    src={imageUrl}
                    alt="Comprobante de pago"
                    fill
                    unoptimized
                    className="object-contain"
                  />
                ) : (
                  <div className="flex h-full items-center justify-center text-xs text-muted-foreground">
                    Sin imagen disponible
                  </div>
                )}
                {isExtracting ? (
                  <div className="absolute inset-0 flex flex-col items-center justify-center gap-2 bg-background/70 backdrop-blur-xs">
                    <Loader2 className="size-6 animate-spin text-primary" aria-hidden="true" />
                    <span className="text-xs font-medium text-foreground">
                      Interpretando imagen...
                    </span>
                  </div>
                ) : null}
              </div>

              {imageUrl ? (
                <a
                  href={imageUrl}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="flex items-center justify-center gap-1.5 text-xs text-muted-foreground hover:text-foreground">
                  <ExternalLink className="size-3" aria-hidden="true" />
                  Abrir imagen en tamaño completo
                </a>
              ) : null}

              {extractionSummary ? (
                <div className="rounded-lg border border-primary/20 bg-primary/5 p-2.5 text-xs text-muted-foreground">
                  <div className="flex items-center gap-1 font-medium text-foreground">
                    <Sparkles className="size-3 text-primary" aria-hidden="true" />
                    Resumen IA
                  </div>
                  <p className="mt-1 line-clamp-3 leading-relaxed">{extractionSummary}</p>
                </div>
              ) : null}
            </div>

            {/* Right side: Extracted and Editable Form */}
            <div className="flex flex-col gap-4 md:col-span-7">
              {/* Client Info Banner */}
              <div className="flex items-center justify-between rounded-xl border border-border/60 bg-muted/20 p-3 text-xs">
                <div>
                  <div className="font-semibold text-foreground">
                    {client?.name || "Cliente desconocido"}
                  </div>
                  <div className="text-muted-foreground font-mono">
                    {client?.phone || client?.whatsapp_id || "Sin teléfono"}
                  </div>
                </div>
                {isClientLinked ? (
                  <Badge variant="success" className="gap-1">
                    <CheckCircle2 className="size-3" aria-hidden="true" />
                    Vinculado a Wispro
                  </Badge>
                ) : (
                  <Badge variant="warning" className="gap-1">
                    <AlertCircle className="size-3" aria-hidden="true" />
                    Sin vincular a Wispro
                  </Badge>
                )}
              </div>

              {/* Amounts Grid */}
              <div className="grid grid-cols-2 gap-3">
                <div className="flex flex-col gap-1.5">
                  <Label htmlFor="amountBs" className="text-xs font-medium">
                    Monto en Bolívares (Bs.)
                  </Label>
                  <Input
                    id="amountBs"
                    placeholder="ej. 26796.30"
                    value={amountBs}
                    onChange={handleAmountBsChange}
                    className="font-mono"
                    required
                  />
                </div>

                <div className="flex flex-col gap-1.5">
                  <Label htmlFor="amountUsd" className="text-xs font-medium">
                    Monto en Dólares (USD)
                  </Label>
                  <Input
                    id="amountUsd"
                    placeholder="ej. 25.10"
                    value={amountUsd}
                    onChange={handleAmountUsdChange}
                    className="font-mono font-semibold"
                    required
                  />
                </div>
              </div>

              {/* Live BCV rate */}
              {bcvRate > 0 ? (
                <div className="flex items-center justify-between text-[11px] text-muted-foreground">
                  <span className="flex items-center gap-1">
                    <RefreshCw className="size-3" aria-hidden="true" />
                    Tasa BCV del día ({bcvAsOf}): {formatBcvRate(bcvRate)}
                  </span>
                  <span>Calculado al cambio oficial</span>
                </div>
              ) : null}

              {/* Bank Selector */}
              <div className="flex flex-col gap-1.5">
                <Label className="text-xs font-medium flex items-center justify-between">
                  <span className="flex items-center gap-1.5">
                    <Building2 className="size-3.5 text-muted-foreground" aria-hidden="true" />
                    Banco Receptor (Cuenta de la Empresa)
                  </span>
                  {bank ? (
                    <span className="text-[11px] font-normal text-muted-foreground">
                      Seleccionado: <strong className="text-foreground">{bank}</strong>
                    </span>
                  ) : null}
                </Label>

                {/* Common Bank Quick Buttons */}
                <div className="grid grid-cols-2 sm:grid-cols-3 gap-2">
                  {COMMON_BANKS.map((item) => {
                    const isSelected =
                      bank === item.label ||
                      normalizeReceptorBank(bank) === item.label ||
                      bank.toLowerCase() === item.id.toLowerCase();
                    return (
                      <Button
                        key={item.id}
                        type="button"
                        size="sm"
                        variant={isSelected ? "default" : "outline"}
                        onClick={() => handleSelectBank(item.label)}
                        className={`h-8 text-xs font-medium ${
                          isSelected
                            ? "bg-primary text-primary-foreground"
                            : "hover:bg-muted"
                        }`}>
                        {item.label}
                      </Button>
                    );
                  })}
                </div>

                <Input
                  placeholder="O escribe otro método o banco (ej: Bancamiga, Zelle, Binance...)"
                  value={bank}
                  onChange={(e) => setBank(e.target.value)}
                  className="mt-1"
                  required
                />
              </div>

              {/* Reference and Date */}
              <div className="grid grid-cols-2 gap-3">
                <div className="flex flex-col gap-1.5">
                  <Label htmlFor="reference" className="text-xs font-medium flex items-center gap-1">
                    <Hash className="size-3.5 text-muted-foreground" aria-hidden="true" />
                    Referencia / Comprobante
                  </Label>
                  <Input
                    id="reference"
                    placeholder="ej. 63082316683"
                    value={transactionCode}
                    onChange={(e) => setTransactionCode(e.target.value)}
                    className="font-mono"
                    required
                  />
                </div>

                <div className="flex flex-col gap-1.5">
                  <Label htmlFor="paymentDate" className="text-xs font-medium flex items-center gap-1">
                    <Calendar className="size-3.5 text-muted-foreground" aria-hidden="true" />
                    Fecha del Pago
                  </Label>
                  <Input
                    id="paymentDate"
                    type="date"
                    value={paymentDate}
                    onChange={(e) => setPaymentDate(e.target.value)}
                    required
                  />
                </div>
              </div>

              {/* Observations / Comment */}
              <div className="flex flex-col gap-1.5">
                <Label htmlFor="comment" className="text-xs font-medium">
                  Nota / Observación (opcional)
                </Label>
                <Input
                  id="comment"
                  placeholder="ej. Pago mensualidad contrato"
                  value={comment}
                  onChange={(e) => setComment(e.target.value)}
                />
              </div>

              {/* Toggles */}
              <div className="flex flex-col gap-2 rounded-xl border border-border/60 p-3 bg-muted/10">
                <div className="flex items-center justify-between">
                  <div className="flex flex-col">
                    <span className="text-xs font-medium text-foreground">
                      Registrar en Wispro inmediatamente
                    </span>
                    <span className="text-[11px] text-muted-foreground">
                      Aplica el pago a las facturas pendientes del cliente en Wispro.
                    </span>
                  </div>
                  <Switch
                    checked={registerInWispro && isClientLinked}
                    disabled={!isClientLinked}
                    onCheckedChange={setRegisterInWispro}
                    aria-label="Registrar en Wispro inmediatamente"
                  />
                </div>

                {registerInWispro ? (
                  <div className="mt-1 flex items-center justify-between border-t border-border/40 pt-2">
                    <div className="flex flex-col">
                      <span className="text-xs font-medium text-foreground">
                        Notificar al cliente por WhatsApp
                      </span>
                      <span className="text-[11px] text-muted-foreground">
                        Envía confirmación automática de pago aprobado al chat.
                      </span>
                    </div>
                    <Switch
                      checked={notifyClient}
                      onCheckedChange={setNotifyClient}
                      aria-label="Notificar al cliente por WhatsApp"
                    />
                  </div>
                ) : null}
              </div>
            </div>
          </div>

          <DialogFooter className={`border-t p-4 sm:justify-between ${CRM_SURFACES.border}`}>
            <Button
              type="button"
              variant="outline"
              disabled={isSubmitting}
              onClick={() => onOpenChange(false)}>
              Cancelar
            </Button>
            <Button
              type="submit"
              disabled={isSubmitting || isExtracting}
              className="gap-2 bg-emerald-600 text-white hover:bg-emerald-700 dark:bg-emerald-600 dark:hover:bg-emerald-700">
              {isSubmitting ? (
                <>
                  <Loader2 className="size-4 animate-spin" aria-hidden="true" />
                  Registrando pago...
                </>
              ) : (
                <>
                  <CheckCircle2 className="size-4" aria-hidden="true" />
                  {registerInWispro ? "Confirmar y Registrar en Wispro" : "Guardar en Bandeja"}
                </>
              )}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
};
