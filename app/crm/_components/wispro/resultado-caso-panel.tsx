"use client";

import { useEffect, useMemo, useState } from "react";
import { Check, Copy, RefreshCw } from "lucide-react";
import { CRM_SURFACES } from "../../_lib/crm-theme";
import { Button } from "@/components/ui/button";
import type { ResultadoCaso } from "@/lib/wispro-types";

interface ResultadoCasoPanelProps {
  result: ResultadoCaso;
  onRetryFailed?: () => void;
  isRetrying?: boolean;
}

const Row = ({
  label,
  ok,
  detail,
}: {
  label: string;
  ok: boolean | null;
  detail: string;
}) => {
  const tone =
    ok === true
      ? "border-emerald-300 bg-emerald-50 text-emerald-900 dark:border-emerald-500/40 dark:bg-emerald-950/50 dark:text-emerald-100"
      : ok === false
        ? "border-red-300 bg-red-50 text-red-900 dark:border-red-500/40 dark:bg-red-950/50 dark:text-red-100"
        : "border-slate-200 bg-slate-50 text-slate-600 dark:border-white/10 dark:bg-white/[.04] dark:text-slate-300";

  return (
    <div className={`rounded-2xl border px-3 py-2 text-sm ${tone}`}>
      <p className="font-medium">{label}</p>
      <p className="mt-0.5 text-xs break-words">{detail}</p>
    </div>
  );
};

export const ResultadoCasoPanel = ({
  result,
  onRetryFailed,
  isRetrying = false,
}: ResultadoCasoPanelProps) => {
  const [copied, setCopied] = useState(false);
  const publicId =
    result.ticket.ok && result.ticket.publicId != null
      ? String(result.ticket.publicId)
      : null;
  const canRetry =
    result.ticket.ok &&
    ((result.orden && result.orden.ok === false) ||
      (result.tecnico && result.tecnico.ok === false));

  useEffect(() => {
    if (!copied) return;
    const timer = window.setTimeout(() => setCopied(false), 1500);
    return () => window.clearTimeout(timer);
  }, [copied]);

  const handleCopy = async () => {
    if (!publicId) return;
    await navigator.clipboard.writeText(publicId);
    setCopied(true);
  };

  const ticketDetail = useMemo(() => {
    if (!result.ticket.ok) return result.ticket.error;
    return publicId
      ? `UUID ${result.ticket.id} · public_id ${publicId}`
      : `UUID ${result.ticket.id}`;
  }, [publicId, result.ticket]);

  return (
    <div className="space-y-3">
      {publicId ? (
        <div className="flex items-center justify-between gap-3 rounded-2xl border border-emerald-300 bg-emerald-50 px-4 py-3 dark:border-emerald-500/40 dark:bg-emerald-950/40">
          <div>
            <p className={`text-[11px] uppercase tracking-wide ${CRM_SURFACES.textMuted}`}>
              Número para el cliente
            </p>
            <p className="font-mono text-3xl font-semibold text-emerald-800 dark:text-emerald-100">
              #{publicId}
            </p>
          </div>
          <Button type="button" variant="secondary" onClick={() => void handleCopy()}>
            {copied ? <Check className="size-4" /> : <Copy className="size-4" />}
            {copied ? "Copiado" : "Copiar"}
          </Button>
        </div>
      ) : null}

      <Row
        label="Ticket"
        ok={result.ticket.ok}
        detail={ticketDetail}
      />
      <Row
        label="Orden de trabajo"
        ok={result.orden.ok}
        detail={
          result.orden.ok === true
            ? result.orden.id
            : result.orden.ok === false
              ? result.orden.error
              : "No solicitada"
        }
      />
      <Row
        label="Técnico"
        ok={result.tecnico.ok}
        detail={
          result.tecnico.ok === true
            ? "Asignado y agendado"
            : result.tecnico.ok === false
              ? result.tecnico.error
              : "Sin asignar"
        }
      />
      {result.crm ? (
        <Row
          label="Ficha CRM (Nova / técnicos)"
          ok={result.crm.ok}
          detail={
            result.crm.ok === true
              ? "Ticket, foto de fachada y Maps listos para Nova y el técnico"
              : result.crm.ok === false
                ? result.crm.error
                : "Sin ficha local"
          }
        />
      ) : null}

      {canRetry && onRetryFailed ? (
        <Button
          type="button"
          variant="secondary"
          disabled={isRetrying}
          onClick={onRetryFailed}>
          <RefreshCw className="size-4" />
          {isRetrying ? "Reintentando pasos fallidos..." : "Reintentar solo los pasos fallidos"}
        </Button>
      ) : null}
    </div>
  );
};
