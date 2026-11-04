"use client";

import { useCallback, useEffect, useState, useTransition } from "react";
import { FileSpreadsheet, HandCoins, RefreshCw } from "lucide-react";
import { toast } from "sonner";
import { CRM_SURFACES } from "../../_lib/crm-theme";
import type {
  CrmPayment,
  CrmPaymentBankStat,
  CrmPaymentStatus,
  CrmPaymentStatusCounts,
} from "../../_lib/payments";
import { formatPaymentField, normalizeReceptorBank } from "../../_lib/payments";
import { roundMoney } from "../../_lib/payment-amount-compare";
import type { Agent } from "../../_lib/types";
import { Button } from "@/components/ui/button";
import { LoadingState } from "../shared/loading-state";
import { PaymentsBankCards } from "./payments-bank-cards";
import { PaymentsExportDialog } from "./payments-export-dialog";
import { CreatePaymentDialog } from "./create-payment-dialog";
import {
  PaymentsFilters,
  PaymentsPagination,
  type PaymentsDateRange,
} from "./payments-filters";
import { PaymentsStats } from "./payments-stats";
import { PaymentsTable } from "./payments-table";

const PAGE_SIZE = 25;
const SEARCH_DEBOUNCE_MS = 300;

const toCaracasIsoDate = (date: Date) =>
  new Intl.DateTimeFormat("en-CA", {
    timeZone: "America/Caracas",
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  }).format(date);

const todayIso = () => toCaracasIsoDate(new Date());

const EMPTY_COUNTS: CrmPaymentStatusCounts = {
  RECIBIDO: 0,
  EN_PROCESO: 0,
  APROBADO: 0,
  RECHAZADO: 0,
  DUPLICADO: 0,
  ERROR: 0,
};

const DEFAULT_DATE_RANGE = (): PaymentsDateRange => {
  const today = todayIso();
  return { from: today, to: today };
};

export type PaymentReviewedPayload = {
  conversationId: number;
  agentId: number;
  action: "approve" | "reject" | "approve_manual";
  assigned: boolean;
};

interface PaymentsViewProps {
  currentAgent?: Pick<Agent, "id" | "name"> | null;
  onOpenClientChat?: (conversationId: number) => void;
  /** After approve/reject: sync inbox assignment locally (no full CRM reload). */
  onPaymentReviewed?: (payload: PaymentReviewedPayload) => void | Promise<void>;
}

export const PaymentsView = ({
  currentAgent,
  onOpenClientChat,
  onPaymentReviewed,
}: PaymentsViewProps) => {
  const [searchTerm, setSearchTerm] = useState("");
  const [debouncedSearch, setDebouncedSearch] = useState("");
  const [dateRange, setDateRange] = useState<PaymentsDateRange>(DEFAULT_DATE_RANGE);
  const [status, setStatus] = useState<CrmPaymentStatus | "all">("EN_PROCESO");
  const [bank, setBank] = useState("all");
  const [page, setPage] = useState(1);
  const [payments, setPayments] = useState<CrmPayment[]>([]);
  const [banks, setBanks] = useState<string[]>([]);
  const [bankStats, setBankStats] = useState<CrmPaymentBankStat[]>([]);
  const [counts, setCounts] = useState<CrmPaymentStatusCounts>(EMPTY_COUNTS);
  const [total, setTotal] = useState(0);
  const [isLoading, setIsLoading] = useState(true);
  const [isRefreshing, setIsRefreshing] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [updatingId, setUpdatingId] = useState<string | null>(null);
  const [isExportDialogOpen, setIsExportDialogOpen] = useState(false);
  const [isCreatePaymentOpen, setIsCreatePaymentOpen] = useState(false);
  const [, startTransition] = useTransition();

  const handlePaymentCreated = (newPayment: CrmPayment) => {
    setPayments((current) => [newPayment, ...current]);
    setTotal((current) => current + 1);
    const statusKey = newPayment.status;
    setCounts((current) => ({
      ...current,
      [statusKey]: (current[statusKey] || 0) + 1,
    }));
    void loadPayments("refresh");
  };

  useEffect(() => {
    const timeoutId = window.setTimeout(() => {
      setDebouncedSearch(searchTerm.trim());
      setPage(1);
    }, SEARCH_DEBOUNCE_MS);

    return () => window.clearTimeout(timeoutId);
  }, [searchTerm]);

  const loadPayments = useCallback(
    async (mode: "initial" | "refresh" = "initial") => {
      if (mode === "refresh") setIsRefreshing(true);
      else setIsLoading(true);

      try {
        const params = new URLSearchParams();
        if (debouncedSearch) params.set("q", debouncedSearch);
        if (dateRange.from) params.set("from", dateRange.from);
        if (dateRange.to) params.set("to", dateRange.to);
        if (status !== "all") params.set("status", status);
        if (bank !== "all") params.set("bank", bank);
        params.set("limit", String(PAGE_SIZE));
        params.set("offset", String((Math.max(page, 1) - 1) * PAGE_SIZE));

        const response = await fetch(`/api/crm/payments?${params.toString()}`);
        const payload = (await response.json()) as {
          ok?: boolean;
          error?: string;
          payments?: CrmPayment[];
          total?: number;
          counts?: CrmPaymentStatusCounts;
          banks?: string[];
          bankStats?: CrmPaymentBankStat[];
        };

        if (!response.ok || !payload.ok) {
          throw new Error(payload.error || "No se pudieron cargar los pagos");
        }

        const nextTotal = payload.total ?? 0;
        const maxPage = Math.max(1, Math.ceil(nextTotal / PAGE_SIZE));
        if (page > maxPage) {
          setPage(maxPage);
        }

        setPayments(payload.payments || []);
        setTotal(nextTotal);
        setCounts(payload.counts || EMPTY_COUNTS);
        setBanks(payload.banks || []);
        setBankStats(payload.bankStats || []);
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
    [bank, dateRange.from, dateRange.to, debouncedSearch, page, status],
  );

  useEffect(() => {
    void loadPayments();
  }, [loadPayments]);

  const handleClearFilters = () => {
    setSearchTerm("");
    setDebouncedSearch("");
    setDateRange(DEFAULT_DATE_RANGE());
    setStatus("EN_PROCESO");
    setBank("all");
    setPage(1);
  };

  const handleDateRangeChange = (value: PaymentsDateRange) => {
    setDateRange(value);
    setPage(1);
  };

  const handleStatusChange = (value: CrmPaymentStatus | "all") => {
    setStatus(value);
    setPage(1);
  };

  const handleBankChange = (value: string) => {
    setBank(value);
    setPage(1);
  };

  const handleBankCardClick = (clickedBank: string) => {
    setBank((current) => (current === clickedBank ? "all" : clickedBank));
    setPage(1);
  };

  /** Local list/stats update — no full refetch after approve/reject. */
  const applyLocalPaymentUpdate = (
    previous: CrmPayment | undefined,
    nextPayment: CrmPayment,
  ) => {
    const previousStatus = previous?.status;
    const nextStatus = nextPayment.status;

    if (previousStatus && previousStatus !== nextStatus) {
      setCounts((current) => ({
        ...current,
        [previousStatus]: Math.max(0, (current[previousStatus] || 0) - 1),
        [nextStatus]: (current[nextStatus] || 0) + 1,
      }));

      const rawBank = nextPayment.bank || previous?.bank;
      const bankName = normalizeReceptorBank(rawBank);
      const amount = Number(nextPayment.amount ?? previous?.amount ?? 0);
      const validAmount = Number.isFinite(amount) && amount > 0 ? amount : 0;

      if (bankName && validAmount > 0) {
        setBankStats((current) =>
          current.map((stat) => {
            if (stat.bank !== bankName) return stat;
            let approvedDelta = 0;
            let inProcessDelta = 0;

            if (previousStatus === "APROBADO") approvedDelta -= 1;
            else if (previousStatus === "EN_PROCESO" || previousStatus === "RECIBIDO") inProcessDelta -= 1;

            if (nextStatus === "APROBADO") approvedDelta += 1;
            else if (nextStatus === "EN_PROCESO" || nextStatus === "RECIBIDO") inProcessDelta += 1;

            return {
              ...stat,
              approvedCount: Math.max(0, stat.approvedCount + approvedDelta),
              approvedAmount: roundMoney(
                Math.max(0, stat.approvedAmount + approvedDelta * validAmount),
              ),
              inProcessCount: Math.max(0, stat.inProcessCount + inProcessDelta),
              inProcessAmount: roundMoney(
                Math.max(0, stat.inProcessAmount + inProcessDelta * validAmount),
              ),
            };
          }),
        );
      }
    }

    const matchesStatusFilter = status === "all" || status === nextStatus;

    if (!matchesStatusFilter) {
      setPayments((current) =>
        current.filter((payment) => payment.id !== nextPayment.id),
      );
      setTotal((current) => Math.max(0, current - 1));
      return;
    }

    setPayments((current) => {
      const exists = current.some((payment) => payment.id === nextPayment.id);
      if (!exists) return [nextPayment, ...current];
      return current.map((payment) =>
        payment.id === nextPayment.id ? nextPayment : payment,
      );
    });
  };

  /** After optimistic status change, only patch row fields — avoid double count/total. */
  const reconcilePaymentRow = (nextPayment: CrmPayment) => {
    setPayments((current) => {
      if (!current.some((payment) => payment.id === nextPayment.id)) {
        return current;
      }
      return current.map((payment) =>
        payment.id === nextPayment.id ? { ...payment, ...nextPayment } : payment,
      );
    });
  };

  const handlePaymentAction = async (
    paymentId: string,
    action: "approve" | "reject" | "approve_manual",
  ) => {
    if (!currentAgent?.id) {
      setError("Debes iniciar sesión como asesor para gestionar pagos");
      toast.error("Sesión de asesor requerida");
      return;
    }

    const paymentBeforeAction = payments.find((item) => item.id === paymentId);
    if (!paymentBeforeAction) {
      toast.error("No se encontró el pago en la lista");
      return;
    }

    const snapshot = {
      payments,
      counts,
      bankStats,
      total,
    };

    const isApproval = action === "approve" || action === "approve_manual";
    const optimisticStatus: CrmPaymentStatus = isApproval
      ? "APROBADO"
      : "RECHAZADO";
    const optimisticPayment: CrmPayment = {
      ...paymentBeforeAction,
      status: optimisticStatus,
      error_message: null,
      updated_at: new Date().toISOString(),
    };

    setUpdatingId(paymentId);
    setError(null);
    startTransition(() => {
      applyLocalPaymentUpdate(paymentBeforeAction, optimisticPayment);
    });

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
        throw new Error(payload.error || "No se pudo actualizar el estado");
      }

      const resolvedConversationId = Number(
        payload.conversation_id ??
          payload.payment.conversation_id ??
          paymentBeforeAction.conversation_id,
      );
      const conversationId =
        Number.isFinite(resolvedConversationId) && resolvedConversationId > 0
          ? resolvedConversationId
          : null;

      const nextPayment: CrmPayment = {
        ...payload.payment,
        conversation_id:
          conversationId ?? payload.payment.conversation_id ?? null,
        client_name:
          payload.payment.client_name ||
          paymentBeforeAction.client_name ||
          null,
        phone_id:
          payload.payment.phone_id || paymentBeforeAction.phone_id || null,
        latest_invoice_date:
          payload.payment.latest_invoice_date ??
          paymentBeforeAction.latest_invoice_date ??
          null,
        expected_amount:
          payload.payment.expected_amount ??
          paymentBeforeAction.expected_amount ??
          null,
        plan_amount:
          payload.payment.plan_amount ??
          paymentBeforeAction.plan_amount ??
          null,
      };

      startTransition(() => {
        if (nextPayment.status === optimisticStatus) {
          reconcilePaymentRow(nextPayment);
        } else {
          applyLocalPaymentUpdate(optimisticPayment, nextPayment);
        }
      });

      if (conversationId) {
        void Promise.resolve(
          onPaymentReviewed?.({
            conversationId,
            agentId: currentAgent.id,
            action,
            assigned: Boolean(payload.assigned),
          }),
        ).catch((reviewError) => {
          console.warn("[PAYMENTS] onPaymentReviewed_failed", reviewError);
        });

        if (!payload.assigned) {
          toast.warning(
            "El pago se actualizó, pero no se pudo asignar el chat automáticamente",
          );
        }
      }

      if (action === "approve_manual") {
        toast.success(
          `Pago de ${formatPaymentField(nextPayment.client_name)} aprobado manualmente (sin Wispro)`,
        );
      } else if (action === "approve") {
        toast.success(
          `Pago de ${formatPaymentField(nextPayment.client_name)} aprobado`,
        );
      } else {
        toast.success(
          payload.assigned
            ? "Pago rechazado y chat asignado a ti"
            : "Pago rechazado",
        );
      }
    } catch (updateError) {
      startTransition(() => {
        setPayments(snapshot.payments);
        setCounts(snapshot.counts);
        setBankStats(snapshot.bankStats);
        setTotal(snapshot.total);
      });
      const message =
        updateError instanceof Error
          ? updateError.message
          : "No se pudo actualizar el estado";
      setError(message);
      toast.error(message);
    } finally {
      setUpdatingId(null);
    }
  };

  const handleApprove = (paymentId: string) => {
    void handlePaymentAction(paymentId, "approve");
  };

  const handleApproveManual = (paymentId: string) => {
    void handlePaymentAction(paymentId, "approve_manual");
  };

  const handleReject = (paymentId: string) => {
    void handlePaymentAction(paymentId, "reject");
  };

  return (
    <div className={`crm-scrollbar min-h-0 flex-1 overflow-y-auto p-4 md:p-6`}>
      <div className="mb-6 flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <h2
            className={`text-xl font-semibold md:text-2xl ${CRM_SURFACES.textPrimary}`}>
            Pagos
          </h2>
          <p className={`text-sm ${CRM_SURFACES.textMuted}`}>
            Bandeja de comprobantes: entran al registrarlos y se completan con la
            extracción
          </p>
        </div>
        <div className="flex w-full flex-col gap-2 sm:w-auto sm:flex-row sm:items-center">
          {currentAgent ? (
            <Button
              type="button"
              onClick={() => setIsCreatePaymentOpen(true)}
              className="w-full cursor-pointer gap-2 bg-emerald-600 text-white hover:bg-emerald-700 dark:bg-emerald-600 dark:hover:bg-emerald-700 sm:w-auto"
              aria-label="Registrar pago manual">
              <HandCoins className="size-4" aria-hidden="true" />
              Registrar pago manual
            </Button>
          ) : null}

          <Button
            type="button"
            variant="outline"
            onClick={() => setIsExportDialogOpen(true)}
            className="w-full cursor-pointer gap-2 border-emerald-500/30 text-emerald-700 hover:bg-emerald-50 hover:text-emerald-800 dark:border-emerald-500/40 dark:text-emerald-400 dark:hover:bg-emerald-950/40 sm:w-auto"
            aria-label="Abrir modal para exportar pagos a Excel">
            <FileSpreadsheet
              className="size-4 text-emerald-600 dark:text-emerald-400"
              aria-hidden="true"
            />
            Exportar a Excel
          </Button>

          <Button
            type="button"
            variant="secondary"
            onClick={() => void loadPayments("refresh")}
            disabled={isRefreshing || isLoading}
            className="w-full cursor-pointer sm:w-auto"
            aria-label="Actualizar listado de pagos">
            <RefreshCw
              className={`mr-2 size-4 ${isRefreshing ? "animate-spin" : ""}`}
              aria-hidden="true"
            />
            Actualizar
          </Button>
        </div>
      </div>

      <div className="space-y-5">
        <PaymentsStats total={total} counts={counts} />
        <PaymentsBankCards
          bankStats={bankStats}
          selectedBank={bank}
          onSelectBank={handleBankCardClick}
        />
        <PaymentsFilters
          searchTerm={searchTerm}
          dateRange={dateRange}
          status={status}
          bank={bank}
          banks={banks}
          onSearchChange={setSearchTerm}
          onDateRangeChange={handleDateRangeChange}
          onStatusChange={handleStatusChange}
          onBankChange={handleBankChange}
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
            <PaymentsTable
              payments={payments}
              updatingId={updatingId}
              onApprove={handleApprove}
              onApproveManual={handleApproveManual}
              onReject={handleReject}
              onOpenChat={onOpenClientChat}
            />
            <PaymentsPagination
              page={page}
              pageSize={PAGE_SIZE}
              total={total}
              isLoading={isRefreshing}
              onPageChange={setPage}
            />
          </>
        )}
      </div>

      <PaymentsExportDialog
        open={isExportDialogOpen}
        onOpenChange={setIsExportDialogOpen}
        availableBanks={banks}
        currentBankFilter={bank}
        currentDateRange={dateRange}
        currentStatus={status}
        bankStats={bankStats}
      />

      {currentAgent ? (
        <CreatePaymentDialog
          open={isCreatePaymentOpen}
          onOpenChange={setIsCreatePaymentOpen}
          currentAgent={currentAgent}
          onPaymentCreated={handlePaymentCreated}
        />
      ) : null}
    </div>
  );
};
