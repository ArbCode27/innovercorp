"use client";

import { useCallback, useEffect, useState } from "react";
import { RefreshCw } from "lucide-react";
import { toast } from "sonner";
import { CRM_SURFACES } from "../../_lib/crm-theme";
import type {
  CrmPayment,
  CrmPaymentStatus,
  CrmPaymentStatusCounts,
} from "../../_lib/payments";
import { formatPaymentField } from "../../_lib/payments";
import type { Agent } from "../../_lib/types";
import { CrmButton } from "../shared/crm-button";
import { LoadingState } from "../shared/loading-state";
import {
  OpenClientChatDialog,
  type OpenClientChatPrompt,
} from "./open-client-chat-dialog";
import { PaymentsFilters } from "./payments-filters";
import { PaymentsStats } from "./payments-stats";
import { PaymentsTable } from "./payments-table";

const PAGE_SIZE = 50;
const SEARCH_DEBOUNCE_MS = 300;
type PaymentPeriod = "today" | "week" | "month";

const toCaracasIsoDate = (date: Date) =>
  new Intl.DateTimeFormat("en-CA", {
    timeZone: "America/Caracas",
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  }).format(date);

const resolvePeriodRange = (value: PaymentPeriod) => {
  const now = new Date();
  const to = toCaracasIsoDate(now);

  if (value === "today") {
    return { from: to, to };
  }

  if (value === "week") {
    const fromDate = new Date(now);
    fromDate.setDate(now.getDate() - 6);
    return { from: toCaracasIsoDate(fromDate), to };
  }

  const fromDate = new Date(now.getFullYear(), now.getMonth(), 1);
  return { from: toCaracasIsoDate(fromDate), to };
};

const EMPTY_COUNTS: CrmPaymentStatusCounts = {
  RECIBIDO: 0,
  EN_PROCESO: 0,
  APROBADO: 0,
  RECHAZADO: 0,
  DUPLICADO: 0,
  ERROR: 0,
};

export type PaymentReviewedPayload = {
  conversationId: number;
  agentId: number;
  action: "approve" | "reject";
  assigned: boolean;
};

interface PaymentsViewProps {
  currentAgent?: Pick<Agent, "id" | "name"> | null;
  onOpenClientChat?: (conversationId: number) => void;
  /** After approve/reject: refresh CRM inbox + reinforce assignment. */
  onPaymentReviewed?: (payload: PaymentReviewedPayload) => void | Promise<void>;
}

export const PaymentsView = ({
  currentAgent,
  onOpenClientChat,
  onPaymentReviewed,
}: PaymentsViewProps) => {
  const [searchTerm, setSearchTerm] = useState("");
  const [debouncedSearch, setDebouncedSearch] = useState("");
  const [period, setPeriod] = useState<PaymentPeriod>("today");
  const [status, setStatus] = useState<CrmPaymentStatus | "all">("all");
  const [bank, setBank] = useState("all");
  const [payments, setPayments] = useState<CrmPayment[]>([]);
  const [banks, setBanks] = useState<string[]>([]);
  const [counts, setCounts] = useState<CrmPaymentStatusCounts>(EMPTY_COUNTS);
  const [total, setTotal] = useState(0);
  const [isLoading, setIsLoading] = useState(true);
  const [isRefreshing, setIsRefreshing] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [updatingId, setUpdatingId] = useState<string | null>(null);
  const [chatPrompt, setChatPrompt] = useState<OpenClientChatPrompt | null>(
    null,
  );
  const [isChatPromptOpen, setIsChatPromptOpen] = useState(false);

  useEffect(() => {
    const timeoutId = window.setTimeout(() => {
      setDebouncedSearch(searchTerm.trim());
    }, SEARCH_DEBOUNCE_MS);

    return () => window.clearTimeout(timeoutId);
  }, [searchTerm]);

  const loadPayments = useCallback(
    async (mode: "initial" | "refresh" = "initial") => {
      if (mode === "refresh") setIsRefreshing(true);
      else setIsLoading(true);

      try {
        const params = new URLSearchParams();
        const range = resolvePeriodRange(period);
        if (debouncedSearch) params.set("q", debouncedSearch);
        if (range.from) params.set("from", range.from);
        if (range.to) params.set("to", range.to);
        if (status !== "all") params.set("status", status);
        if (bank !== "all") params.set("bank", bank);
        params.set("limit", String(PAGE_SIZE));
        params.set("offset", "0");

        const response = await fetch(`/api/crm/payments?${params.toString()}`);
        const payload = (await response.json()) as {
          ok?: boolean;
          error?: string;
          payments?: CrmPayment[];
          total?: number;
          counts?: CrmPaymentStatusCounts;
          banks?: string[];
        };

        if (!response.ok || !payload.ok) {
          throw new Error(payload.error || "No se pudieron cargar los pagos");
        }

        setPayments(payload.payments || []);
        setTotal(payload.total ?? 0);
        setCounts(payload.counts || EMPTY_COUNTS);
        setBanks(payload.banks || []);
        setError(null);
      } catch (loadError) {
        setError(
          loadError instanceof Error
            ? loadError.message
            : "No se pudieron cargar los pagos",
        );
      } finally {
        setIsLoading(false);
        setIsRefreshing(false);
      }
    },
    [bank, debouncedSearch, period, status],
  );

  useEffect(() => {
    void loadPayments();
  }, [loadPayments]);

  const handleClearFilters = () => {
    setSearchTerm("");
    setDebouncedSearch("");
    setPeriod("today");
    setStatus("all");
    setBank("all");
  };

  const offerOpenClientChat = (
    payment: CrmPayment,
    conversationIdOverride?: number | null,
  ) => {
    if (!onOpenClientChat) return;
    const conversationId = Number(
      conversationIdOverride ?? payment.conversation_id,
    );
    if (!Number.isFinite(conversationId) || conversationId <= 0) return;

    setChatPrompt({
      conversationId,
      clientName: formatPaymentField(payment.client_name),
    });
    setIsChatPromptOpen(true);
  };

  const handlePaymentAction = async (
    paymentId: string,
    action: "approve" | "reject",
  ) => {
    if (!currentAgent?.id) {
      setError("Debes iniciar sesión como asesor para gestionar pagos");
      toast.error("Sesión de asesor requerida");
      return;
    }

    setUpdatingId(paymentId);
    setError(null);
    const paymentBeforeAction = payments.find((item) => item.id === paymentId);

    try {
      const response = await fetch("/api/crm/payments", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          id: paymentId,
          action,
          agent_id: currentAgent.id,
        }),
      });
      const payload = (await response.json()) as {
        ok?: boolean;
        error?: string;
        payment?: CrmPayment;
        conversation_id?: number | null;
        assigned?: boolean;
        assigned_agent_id?: number | null;
        assign_skip_reason?: string | null;
      };

      if (!response.ok || !payload.ok || !payload.payment) {
        if (payload.payment) {
          setPayments((current) =>
            current.map((payment) =>
              payment.id === paymentId ? payload.payment! : payment,
            ),
          );
        }
        throw new Error(payload.error || "No se pudo actualizar el estado");
      }

      const resolvedConversationId = Number(
        payload.conversation_id ??
          payload.payment.conversation_id ??
          paymentBeforeAction?.conversation_id,
      );
      const conversationId =
        Number.isFinite(resolvedConversationId) && resolvedConversationId > 0
          ? resolvedConversationId
          : null;

      const approvedPayment: CrmPayment = {
        ...payload.payment,
        conversation_id:
          conversationId ?? payload.payment.conversation_id ?? null,
        client_name:
          payload.payment.client_name ||
          paymentBeforeAction?.client_name ||
          null,
      };

      setPayments((current) =>
        current.map((payment) =>
          payment.id === paymentId ? approvedPayment : payment,
        ),
      );
      await loadPayments("refresh");

      if (conversationId) {
        await onPaymentReviewed?.({
          conversationId,
          agentId: currentAgent.id,
          action,
          assigned: Boolean(payload.assigned),
        });

        if (!payload.assigned) {
          toast.warning(
            "El pago se actualizó, pero no se pudo asignar el chat automáticamente",
          );
        }
      }

      if (action === "approve") {
        offerOpenClientChat(approvedPayment, conversationId);
      } else if (payload.assigned) {
        toast.success("Pago rechazado y chat asignado a ti");
      }
    } catch (updateError) {
      setError(
        updateError instanceof Error
          ? updateError.message
          : "No se pudo actualizar el estado",
      );
    } finally {
      setUpdatingId(null);
    }
  };

  const handleApprove = (paymentId: string) => {
    void handlePaymentAction(paymentId, "approve");
  };

  const handleReject = (paymentId: string) => {
    void handlePaymentAction(paymentId, "reject");
  };

  const handleConfirmOpenChat = (prompt: OpenClientChatPrompt) => {
    onOpenClientChat?.(prompt.conversationId);
  };

  return (
    <div className={`crm-scrollbar min-h-0 flex-1 overflow-y-auto p-4 md:p-6`}>
      <div className="mb-6 flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <h2 className={`text-xl font-semibold md:text-2xl ${CRM_SURFACES.textPrimary}`}>
            Pagos
          </h2>
          <p className={`text-sm ${CRM_SURFACES.textMuted}`}>
            Bandeja de comprobantes: entran al registrarlos y se completan con la
            extracción
          </p>
        </div>
        <CrmButton
          type="button"
          variant="secondary"
          onClick={() => void loadPayments("refresh")}
          disabled={isRefreshing || isLoading}
          className="w-full sm:w-auto"
          aria-label="Actualizar listado de pagos">
          <RefreshCw
            className={`mr-2 size-4 ${isRefreshing ? "animate-spin" : ""}`}
            aria-hidden="true"
          />
          Actualizar
        </CrmButton>
      </div>

      <div className="space-y-5">
        <PaymentsStats total={total} counts={counts} />
        <PaymentsFilters
          searchTerm={searchTerm}
          period={period}
          status={status}
          bank={bank}
          banks={banks}
          onSearchChange={setSearchTerm}
          onPeriodChange={setPeriod}
          onStatusChange={setStatus}
          onBankChange={setBank}
          onClearFilters={handleClearFilters}
        />

        {error ? (
          <p className="rounded-2xl border border-red-200 bg-red-50 px-3 py-2 text-sm text-red-800 dark:border-red-500/40 dark:bg-red-950/40 dark:text-red-100">
            {error}
          </p>
        ) : null}

        {isLoading ? (
          <LoadingState label="Cargando pagos..." />
        ) : (
          <>
            {total > 0 ? (
              <p className={`text-xs ${CRM_SURFACES.textMuted}`}>
                Mostrando {payments.length} de {total}
              </p>
            ) : null}
            <PaymentsTable
              payments={payments}
              updatingId={updatingId}
              onApprove={handleApprove}
              onReject={handleReject}
            />
          </>
        )}
      </div>

      <OpenClientChatDialog
        open={isChatPromptOpen}
        prompt={chatPrompt}
        onOpenChange={(open) => {
          setIsChatPromptOpen(open);
          if (!open) setChatPrompt(null);
        }}
        onConfirm={handleConfirmOpenChat}
      />
    </div>
  );
};
