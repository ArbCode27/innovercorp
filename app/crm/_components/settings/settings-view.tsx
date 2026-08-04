"use client";

import { useEffect, useMemo, useState } from "react";
import { Settings2, Sparkles } from "lucide-react";
import { Textarea } from "@/components/ui/textarea";
import {
  AI_SYSTEM_PROMPT_MAX_LENGTH,
  DEFAULT_AI_SYSTEM_PROMPT,
  promptLooksCompatibleWithGeminiParser,
} from "../../_lib/ai-default-prompt";
import type { Agent, CrmSettings } from "../../_lib/types";
import { isAdminRole } from "../../_lib/agent-role-utils";
import { CRM_SURFACES } from "../../_lib/crm-theme";
import { CrmButton } from "../shared/crm-button";

interface SettingsViewProps {
  currentAgent: Agent;
  settings: CrmSettings;
  onUpdateAiSystemPrompt: (prompt: string | null) => Promise<void>;
}

export const SettingsView = ({
  currentAgent,
  settings,
  onUpdateAiSystemPrompt,
}: SettingsViewProps) => {
  const isAdmin = isAdminRole(currentAgent.role);
  const savedPrompt = settings.ai_system_prompt?.trim() || "";
  const [draftPrompt, setDraftPrompt] = useState(
    savedPrompt || DEFAULT_AI_SYSTEM_PROMPT,
  );
  const [isSavingPrompt, setIsSavingPrompt] = useState(false);

  useEffect(() => {
    setDraftPrompt(savedPrompt || DEFAULT_AI_SYSTEM_PROMPT);
  }, [savedPrompt]);

  const isUsingDefault = !savedPrompt;
  const isDirty = useMemo(() => {
    const normalizedDraft = draftPrompt.trim();
    if (isUsingDefault) {
      return normalizedDraft !== DEFAULT_AI_SYSTEM_PROMPT.trim();
    }
    return normalizedDraft !== savedPrompt;
  }, [draftPrompt, isUsingDefault, savedPrompt]);

  const characterCount = draftPrompt.length;
  const isOverLimit = characterCount > AI_SYSTEM_PROMPT_MAX_LENGTH;
  const showParserWarning =
    draftPrompt.trim().length > 0 &&
    !promptLooksCompatibleWithGeminiParser(draftPrompt);

  const handleSavePrompt = async () => {
    if (!isAdmin || !isDirty || isOverLimit || isSavingPrompt) return;

    setIsSavingPrompt(true);
    try {
      const trimmed = draftPrompt.trim();
      const nextValue =
        !trimmed || trimmed === DEFAULT_AI_SYSTEM_PROMPT.trim()
          ? null
          : trimmed;
      await onUpdateAiSystemPrompt(nextValue);
    } finally {
      setIsSavingPrompt(false);
    }
  };

  const handleRestoreDefault = async () => {
    if (!isAdmin || isSavingPrompt) return;

    setDraftPrompt(DEFAULT_AI_SYSTEM_PROMPT);
    if (isUsingDefault) return;

    setIsSavingPrompt(true);
    try {
      await onUpdateAiSystemPrompt(null);
    } finally {
      setIsSavingPrompt(false);
    }
  };

  return (
    <div
      className={`crm-scrollbar min-h-0 flex-1 overflow-y-auto p-4 md:p-6 ${CRM_SURFACES.page}`}>
      <div className="mb-6">
        <h2
          className={`flex items-center gap-2 text-xl font-semibold md:text-2xl ${CRM_SURFACES.textPrimary}`}>
          <Settings2 className="size-5" aria-hidden="true" />
          Ajustes del CRM
        </h2>
        <p className={`mt-1 text-sm ${CRM_SURFACES.textMuted}`}>
          Configura el prompt del asistente Gemini cuando el bot está activo
        </p>
      </div>

      <div className="mx-auto flex max-w-2xl flex-col gap-4">
        <section
          className={`rounded-xl border p-4 md:p-5 ${CRM_SURFACES.border} ${CRM_SURFACES.elevated}`}>
          <h3 className={`text-base font-semibold ${CRM_SURFACES.textPrimary}`}>
            Motor del bot
          </h3>
          <div className="mt-3 flex items-start gap-3">
            <Sparkles
              className="mt-0.5 size-4 shrink-0 text-blue-500"
              aria-hidden="true"
            />
            <div>
              <p className={`text-sm font-medium ${CRM_SURFACES.textPrimary}`}>
                Gemini
              </p>
              <p className={`mt-1 text-sm ${CRM_SURFACES.textMuted}`}>
                Único motor de IA del CRM. Responde desde este servidor con
                Google AI Studio.
              </p>
              <p className={`mt-2 text-xs ${CRM_SURFACES.textMuted}`}>
                Modelo: {settings.gemini_model || "gemini-2.0-flash"}. Requiere
                `GEMINI_API_KEY` en el servidor.
              </p>
            </div>
          </div>
        </section>

        <section
          className={`rounded-xl border p-4 md:p-5 ${CRM_SURFACES.border} ${CRM_SURFACES.elevated}`}>
          <h3 className={`text-base font-semibold ${CRM_SURFACES.textPrimary}`}>
            Prompt del agente Gemini
          </h3>
          <p className={`mt-1 text-sm ${CRM_SURFACES.textMuted}`}>
            Instrucciones de sistema para el asistente.
            {isUsingDefault
              ? " Ahora se usa el prompt predeterminado."
              : " Ahora se usa un prompt personalizado."}
          </p>

          <label htmlFor="crm-ai-system-prompt" className="sr-only">
            Prompt del sistema para Gemini
          </label>
          <Textarea
            id="crm-ai-system-prompt"
            value={draftPrompt}
            onChange={(event) => setDraftPrompt(event.target.value)}
            disabled={!isAdmin || isSavingPrompt}
            className={`crm-scrollbar mt-4 h-72 resize-none overflow-y-auto font-mono text-xs leading-relaxed ${CRM_SURFACES.input}`}
            aria-describedby="crm-ai-system-prompt-help"
          />
          <div
            id="crm-ai-system-prompt-help"
            className="mt-2 flex flex-wrap items-center justify-between gap-2 text-xs">
            <span
              className={
                isOverLimit ? "text-red-500" : CRM_SURFACES.textMuted
              }>
              {characterCount.toLocaleString("es-VE")} /{" "}
              {AI_SYSTEM_PROMPT_MAX_LENGTH.toLocaleString("es-VE")}
            </span>
            {showParserWarning ? (
              <span className="text-amber-600 dark:text-amber-400">
                Incluye referencias a tools (lookup_wispro, submit_payment,
                escalate_to_human) para mejores resultados.
              </span>
            ) : null}
          </div>

          {!isAdmin ? (
            <p className={`mt-4 text-sm ${CRM_SURFACES.textMuted}`}>
              Solo un administrador puede editar el prompt.
            </p>
          ) : (
            <div className="mt-4 flex flex-wrap gap-2">
              <CrmButton
                type="button"
                variant="primary"
                disabled={!isDirty || isOverLimit || isSavingPrompt}
                onClick={() => void handleSavePrompt()}>
                {isSavingPrompt ? "Guardando…" : "Guardar prompt"}
              </CrmButton>
              <CrmButton
                type="button"
                variant="secondary"
                disabled={isSavingPrompt || isUsingDefault}
                onClick={() => void handleRestoreDefault()}>
                Restaurar predeterminado
              </CrmButton>
            </div>
          )}
        </section>
      </div>
    </div>
  );
};
