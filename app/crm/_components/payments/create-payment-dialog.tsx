"use client";

import { useEffect, useState } from "react";
import {
  AlertCircle,
  Building2,
  Calendar,
  CheckCircle2,
  DollarSign,
  Hash,
  Loader2,
  RefreshCw,
  Search,
  User,
  Wallet,
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
import type { Agent, WisproSearchResult } from "../../_lib/types";
import { wisproService } from "../../_lib/wispro-service";
import { formatBcvRate, roundMoney } from "@/app/api/crm/_lib/dolarvzla-rate";
import { formatClientDebt } from "../../_lib/client-profile-utils";
import { normalizeReceptorBank, type CrmPayment } from "../../_lib/payments";

interface CreatePaymentDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  currentAgent: Pick<Agent, "id" | "name">;
  onPaymentCreated?: (payment: CrmPayment) => void;
}

const COMMON_BANKS = [
  { id: "Bancamiga", label: "Bancamiga" },
  { id: "Banplus", label: "Banplus" },
  { id: "Binance", label: "Binance" },
  { id: "Tarjeta de Débito", label: "Tarjeta de Débito" },
  { id: "Zelle", label: "Zelle" },
  { id: "PayPal", label: "PayPal" },
] as const;

const getTodayInCaracas = () =>
  new Intl.DateTimeFormat("en-CA", {
    timeZone: "America/Caracas",
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  }).format(new Date());

export const CreatePaymentDialog = ({
  open,
  onOpenChange,
  currentAgent,
  onPaymentCreated,
}: CreatePaymentDialogProps) => {
  // Search states
  const [searchQuery, setSearchQuery] = useState("");
  const [isSearching, setIsSearching] = useState(false);
  const [searchResults, setSearchResults] = useState<WisproSearchResult[]>([]);
  const [selectedClient, setSelectedClient] = useState<WisproSearchResult | null>(null);

  // Form states
  const [amountBs, setAmountBs] = useState<string>("");
  const [amountUsd, setAmountUsd] = useState<string>("");
  const [bcvRate, setBcvRate] = useState<number>(0);
  const [bcvAsOf, setBcvAsOf] = useState<string>("");
  const [bank, setBank] = useState<string>("");
  const [transactionCode, setTransactionCode] = useState<string>("");
  const [paymentDate, setPaymentDate] = useState<string>(getTodayInCaracas());
  const [comment, setComment] = useState<string>("");
  const [registerInWispro, setRegisterInWispro] = useState<boolean>(true);
  const [notifyClient, setNotifyClient] = useState<boolean>(true);
  const [isSubmitting, setIsSubmitting] = useState(false);

  // Fetch live BCV rate when dialog opens
  useEffect(() => {
    if (!open) {
      // Reset form on close
      setSearchQuery("");
      setSearchResults([]);
      setSelectedClient(null);
      setAmountBs("");
      setAmountUsd("");
      setBank("");
      setTransactionCode("");
      setPaymentDate(getTodayInCaracas());
      setComment("");
      setRegisterInWispro(true);
      setNotifyClient(true);
      return;
    }

    let isMounted = true;
    const fetchBcv = async () => {
      try {
        const res = await fetch("/api/crm/bcv-rate");
        const data = await res.json();
        if (isMounted && data.ok && data.rate) {
          setBcvRate(Number(data.rate));
          if (data.asOf) setBcvAsOf(String(data.asOf));
        }
      } catch (err) {
        console.warn("[CREATE_PAYMENT_DIALOG] bcv_fetch_error", err);
      }
    };

    fetchBcv();

    return () => {
      isMounted = false;
    };
  }, [open]);

  // Client search by Name or Cédula/RIF
  const handleSearchClient = async (e?: React.FormEvent) => {
    e?.preventDefault();
    const query = searchQuery.trim();
    if (query.length < 2) {
      toast.error("Ingresa al menos 2 caracteres para buscar por nombre o cédula");
      return;
    }

    setIsSearching(true);
    setSearchResults([]);

    try {
      const results = await wisproService.searchClients(query);
      setSearchResults(results);

      if (results.length === 1) {
        handleSelectClient(results[0]);
      } else if (!results.length) {
        toast.info("No se encontró ningún cliente con ese nombre o documento");
      }
    } catch (err) {
      toast.error(
        err instanceof Error ? err.message : "Error al buscar el cliente en Wispro",
      );
    } finally {
      setIsSearching(false);
    }
  };

  const handleSelectClient = (match: WisproSearchResult) => {
    setSelectedClient(match);
    setSearchResults([]);

    // If client has pending debt, pre-fill amount
    const debt = match.invoicing.debt;
    if (debt > 0) {
      setAmountUsd(String(roundMoney(debt, 2)));
      if (bcvRate > 0) {
        setAmountBs(String(roundMoney(debt * bcvRate, 2)));
      }
    }
  };

  // Bidirectional conversion: Bolívares -> Dólares
  const handleAmountBsChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const val = e.target.value;
    setAmountBs(val);

    const clean = val.replace(/\s/g, "").replace(",", ".");
    const numericBs = Number.parseFloat(clean);
    if (Number.isFinite(numericBs) && numericBs > 0 && bcvRate > 0) {
      setAmountUsd(String(roundMoney(numericBs / bcvRate, 2)));
    } else if (!val.trim()) {
      setAmountUsd("");
    }
  };

  // Bidirectional conversion: Dólares -> Bolívares
  const handleAmountUsdChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const val = e.target.value;
    setAmountUsd(val);

    const clean = val.replace(/\s/g, "").replace(",", ".");
    const numericUsd = Number.parseFloat(clean);
    if (Number.isFinite(numericUsd) && numericUsd > 0 && bcvRate > 0) {
      setAmountBs(String(roundMoney(numericUsd * bcvRate, 2)));
    } else if (!val.trim()) {
      setAmountBs("");
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();

    if (!selectedClient) {
      toast.error("Busca y selecciona un cliente primero");
      return;
    }

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
      toast.error("Ingresa una referencia válida (mínimo 3 caracteres)");
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

    setIsSubmitting(true);

    try {
      const numericBs = amountBs
        ? Number.parseFloat(amountBs.replace(",", "."))
        : null;

      const customer = selectedClient.customer;
      const cleanCedula = customer.national_identification_number.replace(/\D/g, "");

      const response = await fetch("/api/crm/payments/manual-register", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
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
          wisproClientId: customer.id,
          clientName: customer.name,
          cedula: cleanCedula,
          phoneId: customer.phone_mobile || null,
        }),
      });

      const data = await response.json();
      if (!response.ok || !data.ok) {
        throw new Error(data.error || "No se pudo registrar el pago");
      }

      toast.success(
        registerInWispro
          ? `Pago registrado y aplicado en Wispro con éxito (Ref: ${cleanRef})`
          : `Pago registrado en la bandeja del CRM (Ref: ${cleanRef})`,
      );

      if (data.payment && onPaymentCreated) {
        onPaymentCreated(data.payment as CrmPayment);
      }

      onOpenChange(false);
    } catch (err) {
      toast.error(
        err instanceof Error ? err.message : "Error al registrar el pago manual",
      );
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className={`max-h-[92vh] w-[95vw] max-w-2xl overflow-y-auto p-0 sm:max-w-xl ${CRM_SURFACES.elevatedTranslucent} ${CRM_SURFACES.border}`}>
        <form onSubmit={handleSubmit}>
          <DialogHeader className={`border-b p-5 ${CRM_SURFACES.border}`}>
            <DialogTitle className="flex items-center gap-2 text-base font-semibold">
              <Wallet className="size-5 text-emerald-500" aria-hidden="true" />
              Registrar Pago Manual
            </DialogTitle>
            <DialogDescription className="text-xs text-muted-foreground">
              Busca el cliente por nombre o cédula, calcula la conversión de divisas y aplica el pago en Wispro.
            </DialogDescription>
          </DialogHeader>

          <div className="flex flex-col gap-5 p-5">
            {/* Step 1: Client Search & Selection */}
            {!selectedClient ? (
              <div className="flex flex-col gap-2.5 rounded-xl border border-border/60 bg-muted/20 p-4">
                <Label htmlFor="searchClient" className="text-xs font-semibold flex items-center gap-1.5">
                  <User className="size-3.5 text-primary" aria-hidden="true" />
                  Buscar Cliente por Nombre o Cédula / RIF
                </Label>
                <div className="flex gap-2">
                  <Input
                    id="searchClient"
                    placeholder="ej. Carlos Sanchez o 12345678"
                    value={searchQuery}
                    onChange={(e) => setSearchQuery(e.target.value)}
                    onKeyDown={(e) => {
                      if (e.key === "Enter") {
                        e.preventDefault();
                        handleSearchClient();
                      }
                    }}
                    className="text-sm"
                    autoFocus
                  />
                  <Button
                    type="button"
                    onClick={() => handleSearchClient()}
                    disabled={isSearching}
                    className="gap-1.5 shrink-0 bg-primary text-primary-foreground">
                    {isSearching ? (
                      <Loader2 className="size-4 animate-spin" aria-hidden="true" />
                    ) : (
                      <Search className="size-4" aria-hidden="true" />
                    )}
                    Buscar
                  </Button>
                </div>

                {/* Multiple search results candidate list */}
                {searchResults.length > 1 ? (
                  <div className="mt-2 flex flex-col gap-1.5 max-h-48 overflow-y-auto">
                    <span className="text-[11px] font-medium text-muted-foreground">
                      Selecciona un cliente:
                    </span>
                    {searchResults.map((result) => (
                      <button
                        key={result.customer.id}
                        type="button"
                        onClick={() => handleSelectClient(result)}
                        className="flex items-center justify-between rounded-lg border border-border/60 bg-background/50 p-2.5 text-left text-xs transition-colors hover:bg-muted">
                        <div>
                          <div className="font-medium text-foreground">{result.customer.name}</div>
                          <div className="font-mono text-[11px] text-muted-foreground">
                            C.I: {result.customer.national_identification_number}
                            {result.customer.phone_mobile ? ` • Telf: ${result.customer.phone_mobile}` : ""}
                          </div>
                        </div>
                        <Badge
                          variant={result.invoicing.hasDebt ? "destructive" : "success"}
                          className="text-[10px]">
                          {result.invoicing.hasDebt
                            ? `Deuda: ${formatClientDebt(result.invoicing.debt)}`
                            : "Al día"}
                        </Badge>
                      </button>
                    ))}
                  </div>
                ) : null}
              </div>
            ) : (
              /* Selected Client Banner */
              <div className="flex items-center justify-between rounded-xl border border-emerald-500/30 bg-emerald-500/10 p-3.5 text-xs">
                <div className="flex flex-col gap-0.5">
                  <span className="text-[10px] font-medium text-emerald-800 dark:text-emerald-300">
                    CLIENTE SELECCIONADO
                  </span>
                  <div className="font-bold text-sm text-foreground">
                    {selectedClient.customer.name}
                  </div>
                  <div className="flex items-center gap-3 font-mono text-[11px] text-muted-foreground">
                    <span>C.I: {selectedClient.customer.national_identification_number}</span>
                    {selectedClient.customer.phone_mobile ? (
                      <span>• Telf: {selectedClient.customer.phone_mobile}</span>
                    ) : null}
                  </div>
                </div>
                <div className="flex flex-col items-end gap-1.5">
                  <Badge
                    variant={selectedClient.invoicing.hasDebt ? "destructive" : "success"}
                    className="text-[11px]">
                    {selectedClient.invoicing.hasDebt
                      ? `Deuda: ${formatClientDebt(selectedClient.invoicing.debt)}`
                      : "Al día"}
                  </Badge>
                  <button
                    type="button"
                    onClick={() => {
                      setSelectedClient(null);
                      setSearchResults([]);
                    }}
                    className="text-[11px] text-primary underline hover:text-primary/80">
                    Cambiar cliente
                  </button>
                </div>
              </div>
            )}

            {/* Step 2: Amounts with live bidirectional conversion */}
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
                  className="font-mono text-sm"
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
                  className="font-mono text-sm font-semibold"
                  required
                />
              </div>
            </div>

            {/* Live BCV rate indicator */}
            {bcvRate > 0 ? (
              <div className="flex items-center justify-between rounded-lg border border-border/50 bg-muted/30 px-3 py-2 text-[11px] text-muted-foreground">
                <span className="flex items-center gap-1.5 font-medium text-foreground">
                  <RefreshCw className="size-3 text-primary" aria-hidden="true" />
                  Tasa BCV del día: <strong className="text-foreground">{formatBcvRate(bcvRate)}</strong>
                  {bcvAsOf ? ` (${bcvAsOf})` : ""}
                </span>
                <span className="text-[10px]">Conversión automática bidireccional</span>
              </div>
            ) : null}

            {/* Step 3: Bank selector */}
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
                      onClick={() => setBank(item.label)}
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
                placeholder="O escribe otro método o banco (ej. Bancamiga, Zelle, Binance...)"
                value={bank}
                onChange={(e) => setBank(e.target.value)}
                className="mt-1"
                required
              />
            </div>

            {/* Step 4: Reference & Date */}
            <div className="grid grid-cols-2 gap-3">
              <div className="flex flex-col gap-1.5">
                <Label htmlFor="reference" className="text-xs font-medium flex items-center gap-1">
                  <Hash className="size-3.5 text-muted-foreground" aria-hidden="true" />
                  Número de Referencia
                </Label>
                <Input
                  id="reference"
                  placeholder="ej. 63082316683"
                  value={transactionCode}
                  onChange={(e) => setTransactionCode(e.target.value)}
                  className="font-mono text-sm"
                  required
                />
              </div>

              <div className="flex flex-col gap-1.5">
                <Label htmlFor="paymentDate" className="text-xs font-medium flex items-center gap-1">
                  <Calendar className="size-3.5 text-muted-foreground" aria-hidden="true" />
                  Fecha de la Transacción
                </Label>
                <Input
                  id="paymentDate"
                  type="date"
                  value={paymentDate}
                  onChange={(e) => setPaymentDate(e.target.value)}
                  className="text-sm"
                  required
                />
              </div>
            </div>

            {/* Step 5: Comment / Note */}
            <div className="flex flex-col gap-1.5">
              <Label htmlFor="comment" className="text-xs font-medium">
                Observación o Nota (opcional)
              </Label>
              <Input
                id="comment"
                placeholder="ej. Pago de mensualidad reportado en oficina"
                value={comment}
                onChange={(e) => setComment(e.target.value)}
                className="text-sm"
              />
            </div>

            {/* Step 6: Options Switches */}
            <div className="flex flex-col gap-2.5 rounded-xl border border-border/60 bg-muted/10 p-3.5">
              <div className="flex items-center justify-between">
                <div className="flex flex-col">
                  <span className="text-xs font-medium text-foreground">
                    Registrar en Wispro inmediatamente
                  </span>
                  <span className="text-[11px] text-muted-foreground">
                    Aplica automáticamente el pago a las facturas pendientes del abonado.
                  </span>
                </div>
                <Switch
                  checked={registerInWispro}
                  onCheckedChange={setRegisterInWispro}
                  aria-label="Registrar en Wispro inmediatamente"
                />
              </div>

              {registerInWispro ? (
                <div className="mt-1 flex items-center justify-between border-t border-border/40 pt-2.5">
                  <div className="flex flex-col">
                    <span className="text-xs font-medium text-foreground">
                      Notificar al cliente por WhatsApp
                    </span>
                    <span className="text-[11px] text-muted-foreground">
                      Envía confirmación automática de pago aprobado al teléfono del cliente.
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
              disabled={isSubmitting || !selectedClient}
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
