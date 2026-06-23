"use client";

import { FormEvent, useEffect, useState } from "react";
import { Search } from "lucide-react";
import { Input } from "@/components/ui/input";
import { CrmButton } from "../shared/crm-button";
import { LoadingState } from "../shared/loading-state";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { CRM_DIALOG, CRM_BADGE_TONES, CRM_SURFACES } from "../../_lib/crm-theme";
import type { WisproSearchResult } from "../../_lib/types";
import { wisproService } from "../../_lib/wispro-service";
import { formatClientDebt } from "../../_lib/client-profile-utils";

const getErrorMessage = (error: unknown, fallback: string) => {
  if (error instanceof Error) {
    return error.message;
  }

  if (typeof error === "object" && error !== null && "message" in error) {
    return String((error as { message: string }).message);
  }

  return fallback;
};

interface WisproSearchDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onAssociate: (result: WisproSearchResult) => Promise<void>;
}

export const WisproSearchDialog = ({
  open,
  onOpenChange,
  onAssociate,
}: WisproSearchDialogProps) => {
  const [cedula, setCedula] = useState("");
  const [results, setResults] = useState<WisproSearchResult[]>([]);
  const [error, setError] = useState<string | null>(null);
  const [isSearching, setIsSearching] = useState(false);
  const [isAssociating, setIsAssociating] = useState(false);
  const [hasSearched, setHasSearched] = useState(false);

  useEffect(() => {
    if (!open) {
      setCedula("");
      setResults([]);
      setError(null);
      setHasSearched(false);
      setIsSearching(false);
      setIsAssociating(false);
    }
  }, [open]);

  const handleSearch = async (event?: FormEvent) => {
    event?.preventDefault();

    const normalized = cedula.trim();
    if (!normalized) {
      setError("Ingresa una cédula");
      return;
    }

    setIsSearching(true);
    setError(null);
    setResults([]);
    setHasSearched(false);

    try {
      const searchResults = await wisproService.searchByCedula(normalized);
      setResults(searchResults);
      setHasSearched(true);

      if (!searchResults.length) {
        setError("No se encontró ningún cliente con esa cédula.");
      }
    } catch (searchError) {
      setError(getErrorMessage(searchError, "Error al consultar Wispro"));
    } finally {
      setIsSearching(false);
    }
  };

  const handleAssociate = async (result: WisproSearchResult) => {
    setIsAssociating(true);
    setError(null);

    try {
      await onAssociate(result);
      onOpenChange(false);
    } catch (associateError) {
      setError(getErrorMessage(associateError, "No se pudo asociar el cliente"));
    } finally {
      setIsAssociating(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className={CRM_DIALOG}>
        <DialogHeader>
          <DialogTitle>Buscar cliente en Wispro</DialogTitle>
          <DialogDescription className={CRM_SURFACES.textMuted}>
            Consulta por cédula y asocia el resultado a la conversación activa.
          </DialogDescription>
        </DialogHeader>

        <form onSubmit={handleSearch} className="space-y-4">
          <div className="space-y-2">
            <label
              htmlFor="wispro-cedula"
              className={`text-xs font-medium uppercase tracking-wide ${CRM_SURFACES.textLabel}`}>
              Número de cédula
            </label>
            <div className="flex gap-2">
              <Input
                id="wispro-cedula"
                value={cedula}
                onChange={(event) => setCedula(event.target.value.replace(/\D/g, ""))}
                placeholder="Ej: 27915967"
                inputMode="numeric"
                autoComplete="off"
                disabled={isSearching || isAssociating}
                className={`${CRM_SURFACES.border} ${CRM_SURFACES.input} ${CRM_SURFACES.textPrimary}`}
              />
              <CrmButton
                type="submit"
                disabled={isSearching || isAssociating}
                aria-label="Buscar en Wispro">
                <Search className="size-4" aria-hidden="true" />
                Buscar
              </CrmButton>
            </div>
          </div>
        </form>

        {isSearching ? (
          <LoadingState label="Consultando Wispro..." />
        ) : null}

        {error ? (
          <p className="text-sm text-red-600 dark:text-red-300" role="alert">
            {error}
          </p>
        ) : null}

        {results.length ? (
          <ul className="space-y-2" aria-label="Resultados de Wispro">
            {results.map((result) => (
              <li key={result.customer.id}>
                <button
                  type="button"
                  disabled={isAssociating}
                  onClick={() => handleAssociate(result)}
                  className={`w-full rounded-lg border p-3 text-left transition-colors disabled:opacity-60 ${CRM_SURFACES.border} ${CRM_SURFACES.card} ${CRM_SURFACES.hover} focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-blue-400`}>
                  <p className={`text-sm font-medium ${CRM_SURFACES.textPrimary}`}>
                    {result.customer.name}
                  </p>
                  <p className={`mt-1 text-xs ${CRM_SURFACES.textMuted}`}>
                    Cédula: {result.customer.national_identification_number}
                    {result.customer.city || result.customer.state
                      ? ` · ${[result.customer.city, result.customer.state].filter(Boolean).join(", ")}`
                      : ""}
                  </p>
                  <p className={`mt-0.5 text-xs ${CRM_SURFACES.textMuted}`}>
                    Tel: {result.customer.phone_mobile || "No registrado"} · Zona:{" "}
                    {result.customer.zone_name || "—"}
                  </p>
                  <p className={`mt-0.5 text-xs ${CRM_SURFACES.textMuted}`}>
                    Deuda:{" "}
                    {result.invoicing.hasDebt
                      ? formatClientDebt(result.invoicing.debt)
                      : "Sin deuda"}
                  </p>
                  <span
                    className={`mt-2 inline-flex rounded-full px-2 py-0.5 text-[11px] font-medium ${CRM_BADGE_TONES.emerald}`}>
                    Haz clic para asociar
                  </span>
                </button>
              </li>
            ))}
          </ul>
        ) : null}

        {hasSearched && !isSearching && !results.length && !error ? (
          <p className={`text-sm ${CRM_SURFACES.textMuted}`}>
            No se encontraron resultados para esa cédula.
          </p>
        ) : null}

        <DialogFooter>
          <CrmButton
            type="button"
            variant="secondary"
            onClick={() => onOpenChange(false)}
            disabled={isAssociating}>
            Cerrar
          </CrmButton>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
};
