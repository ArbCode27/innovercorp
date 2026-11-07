"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import { Check, CheckCircle2, Info, Sparkles, Tag } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { Badge } from "@/components/ui/badge";
import { CRM_SURFACES } from "../../_lib/crm-theme";
import type { Label } from "../../_lib/types";
import {
  buildPaymentSuccessMessage,
  DEFAULT_PAYMENT_SUCCESS_MESSAGE,
  PAYMENT_SUCCESS_MESSAGE_MAX_LENGTH,
  PAYMENT_SUCCESS_VARIABLES,
  resolvePaymentMonth,
} from "../../_lib/payment-success-message";

interface PaymentApprovalSettingsSectionProps {
  isAdmin: boolean;
  savedMessage: string | null;
  savedLabelIds?: number[];
  availableLabels: Label[];
  onSaveMessage: (message: string | null) => Promise<void>;
  onSaveLabelIds: (labelIds: number[]) => Promise<void>;
}

export const PaymentApprovalSettingsSection = ({
  isAdmin,
  savedMessage,
  savedLabelIds = [],
  availableLabels,
  onSaveMessage,
  onSaveLabelIds,
}: PaymentApprovalSettingsSectionProps) => {
  const textareaRef = useRef<HTMLTextAreaElement>(null);

  // Message draft state
  const initialMessage = savedMessage?.trim() || "";
  const [draftMessage, setDraftMessage] = useState<string>(
    initialMessage || DEFAULT_PAYMENT_SUCCESS_MESSAGE,
  );
  const [isSavingMessage, setIsSavingMessage] = useState<boolean>(false);

  // Labels draft state
  const [draftLabelIds, setDraftLabelIds] = useState<number[]>(savedLabelIds);
  const [isSavingLabels, setIsSavingLabels] = useState<boolean>(false);

  useEffect(() => {
    setDraftMessage(savedMessage?.trim() || DEFAULT_PAYMENT_SUCCESS_MESSAGE);
  }, [savedMessage]);

  useEffect(() => {
    setDraftLabelIds(savedLabelIds || []);
  }, [savedLabelIds]);

  // Message dirty & validation checks
  const isUsingDefaultMessage = !savedMessage?.trim();
  const isMessageDirty = useMemo(() => {
    const normalizedDraft = draftMessage.trim();
    if (isUsingDefaultMessage) {
      return normalizedDraft !== DEFAULT_PAYMENT_SUCCESS_MESSAGE.trim();
    }
    return normalizedDraft !== (savedMessage?.trim() || "");
  }, [draftMessage, isUsingDefaultMessage, savedMessage]);

  const characterCount = draftMessage.length;
  const isOverLimit = characterCount > PAYMENT_SUCCESS_MESSAGE_MAX_LENGTH;

  // Labels dirty check
  const isLabelsDirty = useMemo(() => {
    const current = new Set(savedLabelIds || []);
    const draft = new Set(draftLabelIds);
    if (current.size !== draft.size) return true;
    for (const id of current) {
      if (!draft.has(id)) return true;
    }
    return false;
  }, [draftLabelIds, savedLabelIds]);

  // Current month preview resolution
  const currentMonthExample = useMemo(
    () => resolvePaymentMonth(new Date().toISOString()),
    [],
  );

  const previewMessage = useMemo(() => {
    return buildPaymentSuccessMessage({
      template: draftMessage,
      paymentDate: new Date().toISOString(),
    });
  }, [draftMessage]);

  const handleInsertVariable = (token: string) => {
    if (!isAdmin || isSavingMessage) return;

    const textarea = textareaRef.current;
    if (!textarea) {
      setDraftMessage((prev) => `${prev} ${token}`);
      return;
    }

    const start = textarea.selectionStart ?? textarea.value.length;
    const end = textarea.selectionEnd ?? textarea.value.length;
    const before = draftMessage.substring(0, start);
    const after = draftMessage.substring(end);

    const nextValue = `${before}${token}${after}`;
    setDraftMessage(nextValue);

    // Re-focus and move cursor after the inserted variable
    setTimeout(() => {
      textarea.focus();
      const nextCursor = start + token.length;
      textarea.setSelectionRange(nextCursor, nextCursor);
    }, 0);
  };

  const handleToggleLabel = (labelId: number) => {
    if (!isAdmin || isSavingLabels) return;

    setDraftLabelIds((current) =>
      current.includes(labelId)
        ? current.filter((id) => id !== labelId)
        : [...current, labelId],
    );
  };

  const handleSelectAllLabels = () => {
    if (!isAdmin || isSavingLabels) return;
    setDraftLabelIds(availableLabels.map((label) => label.id));
  };

  const handleClearLabels = () => {
    if (!isAdmin || isSavingLabels) return;
    setDraftLabelIds([]);
  };

  const handleSaveMessage = async () => {
    if (!isAdmin || !isMessageDirty || isOverLimit || isSavingMessage) return;
    setIsSavingMessage(true);
    try {
      await onSaveMessage(draftMessage);
    } finally {
      setIsSavingMessage(false);
    }
  };

  const handleRestoreDefaultMessage = async () => {
    if (!isAdmin || isSavingMessage || isUsingDefaultMessage) return;
    setIsSavingMessage(true);
    try {
      await onSaveMessage(null);
      setDraftMessage(DEFAULT_PAYMENT_SUCCESS_MESSAGE);
    } finally {
      setIsSavingMessage(false);
    }
  };

  const handleSaveLabels = async () => {
    if (!isAdmin || !isLabelsDirty || isSavingLabels) return;
    setIsSavingLabels(true);
    try {
      await onSaveLabelIds(draftLabelIds);
    } finally {
      setIsSavingLabels(false);
    }
  };

  return (
    <div className="space-y-6">
      {/* SECTION 1: MENSAJE DE PAGO APROBADO */}
      <section className={`rounded-2xl p-4 md:p-5 ${CRM_SURFACES.elevated}`}>
        <div className="flex flex-wrap items-start justify-between gap-3">
          <div>
            <div className="flex items-center gap-2">
              <Sparkles className="size-4 text-emerald-500" aria-hidden="true" />
              <h3
                className={`text-base font-semibold ${CRM_SURFACES.textPrimary}`}>
                Mensaje de pago aprobado
              </h3>
            </div>
            <p className={`mt-1 text-sm ${CRM_SURFACES.textMuted}`}>
              Se envía automáticamente al cliente por WhatsApp cuando su pago es
              aprobado. Usa las variables dinámicas para personalizarlo.
            </p>
          </div>

          {isAdmin ? (
            <div className="flex flex-wrap items-center gap-2">
              <Button
                type="button"
                variant="default"
                disabled={
                  !isMessageDirty || isOverLimit || isSavingMessage
                }
                onClick={() => void handleSaveMessage()}
                aria-label="Guardar cambios del mensaje de pago">
                {isSavingMessage ? "Guardando…" : "Guardar mensaje"}
              </Button>
              <Button
                type="button"
                variant="secondary"
                disabled={isSavingMessage || isUsingDefaultMessage}
                onClick={() => void handleRestoreDefaultMessage()}
                aria-label="Restaurar mensaje predeterminado de pago">
                Restaurar predeterminado
              </Button>
            </div>
          ) : null}
        </div>

        {/* Dynamic variables toolbar */}
        <div className="mt-4 rounded-xl border border-border/50 bg-muted/40 p-3">
          <div className="flex flex-wrap items-center justify-between gap-2">
            <span
              className={`text-xs font-medium tracking-wide uppercase ${CRM_SURFACES.textMuted}`}>
              Variables dinámicas disponibles
            </span>
            <span className="text-[11px] text-muted-foreground">
              Haz clic para insertar en el mensaje
            </span>
          </div>

          <div className="mt-2.5 flex flex-wrap items-center gap-2">
            {PAYMENT_SUCCESS_VARIABLES.map((v) => (
              <button
                key={v.token}
                type="button"
                disabled={!isAdmin || isSavingMessage}
                onClick={() => handleInsertVariable(v.token)}
                className="group inline-flex items-center gap-1.5 rounded-lg border border-emerald-500/30 bg-emerald-500/10 px-2.5 py-1 text-xs font-semibold text-emerald-600 transition-colors hover:border-emerald-500/60 hover:bg-emerald-500/20 active:scale-95 disabled:pointer-events-none disabled:opacity-50 dark:text-emerald-400"
                title={`${v.description} - Clic para insertar`}>
                <code className="font-mono">{v.token}</code>
                <span className="text-[11px] font-normal text-emerald-700/80 dark:text-emerald-300/80">
                  ({v.label})
                </span>
              </button>
            ))}
          </div>

          <p className="mt-2 text-xs text-muted-foreground">
            Al enviar la notificación, <code>{"{{mes}}"}</code> se reemplazará
            automáticamente por el mes correspondiente al pago (por ejemplo:{" "}
            <strong className="text-foreground">{currentMonthExample}</strong>).
          </p>
        </div>

        {/* Textarea */}
        <label htmlFor="crm-payment-success-message" className="sr-only">
          Mensaje de pago aprobado para el cliente
        </label>
        <Textarea
          ref={textareaRef}
          id="crm-payment-success-message"
          value={draftMessage}
          onChange={(event) => setDraftMessage(event.target.value)}
          disabled={!isAdmin || isSavingMessage}
          className="crm-scrollbar mt-4 h-48 resize-none overflow-y-auto text-sm leading-relaxed md:h-56"
          aria-describedby="crm-payment-success-message-help"
        />

        <div
          id="crm-payment-success-message-help"
          className="mt-2 flex flex-wrap items-center justify-between gap-2 text-xs">
          <span
            className={
              isOverLimit ? "text-red-500 font-semibold" : CRM_SURFACES.textMuted
            }>
            {characterCount.toLocaleString("es-VE")} /{" "}
            {PAYMENT_SUCCESS_MESSAGE_MAX_LENGTH.toLocaleString("es-VE")}{" "}
            caracteres
          </span>

          <span className={CRM_SURFACES.textMuted}>
            {draftMessage.toLowerCase().includes("{{mes}}") ||
            draftMessage.toLowerCase().includes("{mes}") ? (
              <span className="inline-flex items-center gap-1 text-emerald-600 dark:text-emerald-400">
                <Check className="size-3" aria-hidden="true" /> Variable{" "}
                <code>{"{{mes}}"}</code> detectada
              </span>
            ) : (
              <span className="text-amber-500 dark:text-amber-400">
                Tip: Agrega <code>{"{{mes}}"}</code> para insertar el mes
                automáticamente.
              </span>
            )}
          </span>
        </div>

        {/* Live Preview Card */}
        <div className="mt-4 rounded-xl border border-border/60 bg-muted/20 p-3.5">
          <div className="flex items-center gap-1.5 text-xs font-semibold text-muted-foreground uppercase tracking-wide">
            <Info className="size-3.5" aria-hidden="true" />
            Vista previa del mensaje generado
          </div>
          <div className="crm-scrollbar mt-2 max-h-36 overflow-y-auto rounded-lg border border-border/40 bg-background/80 p-3 text-xs leading-relaxed text-foreground/90 whitespace-pre-wrap">
            {previewMessage}
          </div>
        </div>

        {!isAdmin ? (
          <p className={`mt-3 text-sm ${CRM_SURFACES.textMuted}`}>
            Solo un administrador puede editar este mensaje.
          </p>
        ) : null}
      </section>

      {/* SECTION 2: ETIQUETAS AL APROBAR PAGO */}
      <section className={`rounded-2xl p-4 md:p-5 ${CRM_SURFACES.elevated}`}>
        <div className="flex flex-wrap items-start justify-between gap-3">
          <div>
            <div className="flex items-center gap-2">
              <Tag className="size-4 text-primary" aria-hidden="true" />
              <h3
                className={`text-base font-semibold ${CRM_SURFACES.textPrimary}`}>
                Etiquetas al aprobar pago
              </h3>
            </div>
            <p className={`mt-1 text-sm ${CRM_SURFACES.textMuted}`}>
              Selecciona la o las etiquetas que se asignarán automáticamente al
              chat del cliente en el CRM cuando se confirme y apruebe su pago.
            </p>
          </div>

          {isAdmin ? (
            <div className="flex flex-wrap items-center gap-2">
              <Button
                type="button"
                variant="default"
                disabled={!isLabelsDirty || isSavingLabels}
                onClick={() => void handleSaveLabels()}
                aria-label="Guardar etiquetas de pago aprobado">
                {isSavingLabels ? "Guardando…" : "Guardar etiquetas"}
              </Button>
              {draftLabelIds.length > 0 ? (
                <Button
                  type="button"
                  variant="outline"
                  size="sm"
                  disabled={isSavingLabels}
                  onClick={handleClearLabels}
                  aria-label="Limpiar etiquetas seleccionadas">
                  Limpiar selección
                </Button>
              ) : null}
            </div>
          ) : null}
        </div>

        {/* Selection Status Banner */}
        <div className="mt-4 flex flex-wrap items-center justify-between gap-2 text-xs">
          <div className="flex items-center gap-2">
            <span className={CRM_SURFACES.textMuted}>Estado:</span>
            {draftLabelIds.length > 0 ? (
              <Badge variant="secondary" className="gap-1 font-medium">
                <CheckCircle2 className="size-3 text-emerald-500" aria-hidden="true" />
                {draftLabelIds.length}{" "}
                {draftLabelIds.length === 1
                  ? "etiqueta seleccionada"
                  : "etiquetas seleccionadas"}
              </Badge>
            ) : (
              <Badge variant="outline" className="text-muted-foreground">
                Predeterminado del sistema (PAGADO API)
              </Badge>
            )}
          </div>

          {isAdmin && availableLabels.length > 0 ? (
            <div className="flex items-center gap-2">
              <button
                type="button"
                onClick={handleSelectAllLabels}
                className="text-xs text-primary hover:underline">
                Seleccionar todas
              </button>
            </div>
          ) : null}
        </div>

        {/* Labels Grid / Interactive Selector */}
        <div className="mt-3.5">
          {availableLabels.length === 0 ? (
            <div className="rounded-xl border border-dashed border-border/80 p-6 text-center">
              <p className="text-sm text-muted-foreground">
                No hay etiquetas creadas en el CRM. Puedes crearlas en la sección{" "}
                <strong>Etiquetas</strong> del menú principal.
              </p>
            </div>
          ) : (
            <div
              role="group"
              aria-label="Etiquetas disponibles para asignación automática"
              className="flex flex-wrap gap-2.5">
              {availableLabels.map((label) => {
                const isSelected = draftLabelIds.includes(label.id);

                return (
                  <button
                    key={label.id}
                    type="button"
                    disabled={!isAdmin || isSavingLabels}
                    onClick={() => handleToggleLabel(label.id)}
                    aria-pressed={isSelected}
                    className={`group relative inline-flex items-center gap-2 rounded-xl border px-3 py-1.5 text-xs font-medium transition-all ${
                      isSelected
                        ? "border-primary bg-primary/10 text-foreground shadow-xs ring-1 ring-primary/40"
                        : "border-border/70 bg-card text-muted-foreground hover:border-border hover:bg-muted/50 hover:text-foreground"
                    } disabled:pointer-events-none disabled:opacity-50`}>
                    <span
                      className="size-2 shrink-0 rounded-full"
                      style={{ backgroundColor: label.color }}
                      aria-hidden="true"
                    />
                    <span>{label.name}</span>
                    {isSelected ? (
                      <Check
                        className="size-3.5 shrink-0 text-primary"
                        aria-hidden="true"
                      />
                    ) : null}
                  </button>
                );
              })}
            </div>
          )}
        </div>

        {/* Helper footnote */}
        <p className="mt-3 text-xs text-muted-foreground">
          Nota: Al aprobar un pago, además de aplicar estas etiquetas, el sistema
          retirará automáticamente la etiqueta <code>Verificar pago</code> si
          estaba presente en la conversación.
        </p>

        {!isAdmin ? (
          <p className={`mt-3 text-sm ${CRM_SURFACES.textMuted}`}>
            Solo un administrador puede configurar las etiquetas automáticas de pago.
          </p>
        ) : null}
      </section>
    </div>
  );
};
