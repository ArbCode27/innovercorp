"use client";

import { useCallback, useEffect, useState } from "react";
import { RefreshCw } from "lucide-react";
import { CRM_SURFACES } from "../../_lib/crm-theme";
import type {
  CrmPayment,
  CrmPaymentStatus,
  CrmPaymentStatusCounts,
} from "../../_lib/payments";
import { CrmButton } from "../shared/crm-button";
import { LoadingState } from "../shared/loading-state";
import { PaymentsFilters } from "./payments-filters";
import { PaymentsStats } from "./payments-stats";
import { PaymentsTable } from "./payments-table";

const PAGE_SIZE = 50;
const SEARCH_DEBOUNCE_MS = 300;

const EMPTY_COUNTS: CrmPaymentStatusCounts = {
  EN_PROCESO: 0,
  APROBADO: 0,
  RECHAZADO: 0,
  DUPLICADO: 0,
  ERROR: 0,
};

export const PaymentsView = () => {
  const [searchTerm, setSearchTerm] = useState("");
  const [debouncedSearch, setDebouncedSearch] = useState("");
  const [fromDate, setFromDate] = useState("");
  const [toDate, setToDate] = useState("");
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
        if (debouncedSearch) params.set("q", debouncedSearch);
        if (fromDate) params.set("from", fromDate);
        if (toDate) params.set("to", toDate);
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
    [bank, debouncedSearch, fromDate, status, toDate],
  );

  useEffect(() => {
    void loadPayments();
  }, [loadPayments]);

  const handleClearFilters = () => {
    setSearchTerm("");
    setDebouncedSearch("");
    setFromDate("");
    setToDate("");
    setStatus("all");
    setBank("all");
  };

  const handlePaymentAction = async (
    paymentId: string,
    action: "approve" | "reject",
  ) => {
    setUpdatingId(paymentId);
    setError(null);

    try {
      const response = await fetch("/api/crm/payments", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ id: paymentId, action }),
      });
      const payload = (await response.json()) as {
        ok?: boolean;
        error?: string;
        payment?: CrmPayment;
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

      setPayments((current) =>
        current.map((payment) =>
          payment.id === paymentId ? payload.payment! : payment,
        ),
      );
      await loadPayments("refresh");
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

  return (
    <div className={`crm-scrollbar min-h-0 flex-1 overflow-y-auto p-4 md:p-6 ${CRM_SURFACES.page}`}>
      <div className="mb-6 flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <h2 className={`text-xl font-semibold md:text-2xl ${CRM_SURFACES.textPrimary}`}>
            Pagos
          </h2>
          <p className={`text-sm ${CRM_SURFACES.textMuted}`}>
            Comprobantes registrados desde WhatsApp para revisión del asesor
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
          fromDate={fromDate}
          toDate={toDate}
          status={status}
          bank={bank}
          banks={banks}
          onSearchChange={setSearchTerm}
          onFromDateChange={setFromDate}
          onToDateChange={setToDate}
          onStatusChange={setStatus}
          onBankChange={setBank}
          onClearFilters={handleClearFilters}
        />

        {error ? (
          <p className="rounded-lg border border-red-200 bg-red-50 px-3 py-2 text-sm text-red-800 dark:border-red-500/40 dark:bg-red-950/40 dark:text-red-100">
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
    </div>
  );
};
