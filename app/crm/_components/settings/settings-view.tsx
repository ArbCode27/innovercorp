"use client";

import { useEffect, useMemo, useState } from "react";
import { Settings2, Sparkles, Workflow } from "lucide-react";
import { Textarea } from "@/components/ui/textarea";
import {
  AI_SYSTEM_PROMPT_MAX_LENGTH,
  DEFAULT_AI_SYSTEM_PROMPT,
  promptLooksCompatibleWithGeminiParser,
} from "../../_lib/ai-default-prompt";
import type { Agent, BotEngine, CrmSettings } from "../../_lib/types";
import { BOT_ENGINE_LABELS } from "../../_lib/bot-engine";
import { isAdminRole } from "../../_lib/agent-role-utils";
import { CRM_SURFACES } from "../../_lib/crm-theme";
import { CrmButton } from "../shared/crm-button";

interface SettingsViewProps {
  currentAgent: Agent;
  settings: CrmSettings;
  onUpdateGlobalBotEngine: (engine: BotEngine) => Promise<void>;
  onUpdateAiSystemPrompt: (prompt: string | null) => Promise<void>;
}

export const SettingsView = ({
  currentAgent,
  settings,
  onUpdateGlobalBotEngine,
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

  const handleSelect = async (engine: BotEngine) => {
    if (!isAdmin || engine === settings.bot_engine) return;
    await onUpdateGlobalBotEngine(engine);
  };

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
          Configura el motor y el prompt del asistente cuando el bot está activo
        </p>
      </div>

      <div className="mx-auto flex max-w-2xl flex-col gap-4">
        <section
          className={`rounded-xl border p-4 md:p-5 ${CRM_SURFACES.border} ${CRM_SURFACES.elevated}`}>
          <h3 className={`text-base font-semibold ${CRM_SURFACES.textPrimary}`}>
            Motor global del bot
          </h3>
          <p className={`mt-1 text-sm ${CRM_SURFACES.textMuted}`}>
            Activo ahora:{" "}
            <span className="font-medium text-blue-600 dark:text-blue-300">
              {BOT_ENGINE_LABELS[settings.bot_engine]}
            </span>
            . Las conversaciones pueden sobreescribir este valor desde el chat.
          </p>

          {!isAdmin ? (
            <p className={`mt-4 text-sm ${CRM_SURFACES.textMuted}`}>
              Solo un administrador puede cambiar el motor global.
            </p>
          ) : (
            <div className="mt-4 grid gap-3 sm:grid-cols-2">
              <CrmButton
                type="button"
                variant={settings.bot_engine === "gemini" ? "primary" : "secondary"}
                className="h-auto justify-start gap-3 px-4 py-3 text-left"
                onClick={() => handleSelect("gemini")}
                aria-pressed={settings.bot_engine === "gemini"}>
                <Sparkles className="size-4 shrink-0" aria-hidden="true" />
                <span>
                  <span className="block font-semibold">Gemini (backend)</span>
                  <span className="block text-xs opacity-80">
                    Responde con Google AI Studio en este servidor
                  </span>
                </span>
              </CrmButton>

              <CrmButton
                type="button"
                variant={settings.bot_engine === "make" ? "primary" : "secondary"}
                className="h-auto justify-start gap-3 px-4 py-3 text-left"
                onClick={() => handleSelect("make")}
                aria-pressed={settings.bot_engine === "make"}>
                <Workflow className="size-4 shrink-0" aria-hidden="true" />
                <span>
                  <span className="block font-semibold">Make</span>
                  <span className="block text-xs opacity-80">
                    Usa el escenario Make como hasta ahora
                  </span>
                </span>
              </CrmButton>
            </div>
          )}

          <p className={`mt-4 text-xs ${CRM_SURFACES.textMuted}`}>
            Modelo Gemini configurado: {settings.gemini_model || "gemini-2.0-flash"}.
            Requiere `GEMINI_API_KEY` en el servidor.
          </p>
        </section>

        <section
          className={`rounded-xl border p-4 md:p-5 ${CRM_SURFACES.border} ${CRM_SURFACES.elevated}`}>
          <h3 className={`text-base font-semibold ${CRM_SURFACES.textPrimary}`}>
            Prompt del agente Gemini
          </h3>
          <p className={`mt-1 text-sm ${CRM_SURFACES.textMuted}`}>
            Instrucciones de sistema para las conversaciones con motor Gemini.
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
            rows={12}
            maxLength={AI_SYSTEM_PROMPT_MAX_LENGTH}
            spellCheck
            className={`crm-scrollbar mt-4 h-64 max-h-64 min-h-0 resize-none overflow-y-auto font-mono text-sm [field-sizing:fixed] ${CRM_SURFACES.border} ${CRM_SURFACES.input} ${CRM_SURFACES.textPrimary}`}
            aria-describedby="crm-ai-system-prompt-help crm-ai-system-prompt-count"
          />

          <div className="mt-2 flex flex-wrap items-center justify-between gap-2">
            <p
              id="crm-ai-system-prompt-count"
              className={`text-xs ${
                isOverLimit
                  ? "text-red-500"
                  : CRM_SURFACES.textMuted
              }`}>
              {characterCount} / {AI_SYSTEM_PROMPT_MAX_LENGTH}
            </p>
            {showParserWarning ? (
              <p className="text-xs text-amber-600 dark:text-amber-300">
                El parser espera JSON con action/message/reason.
              </p>
            ) : null}
          </div>

          <p
            id="crm-ai-system-prompt-help"
            className={`mt-2 text-xs ${CRM_SURFACES.textMuted}`}>
            El backend añade el contexto del cliente automáticamente. Si dejas el
            prompt vacío o restauras el predeterminado, se usará el prompt interno
            del sistema.
          </p>

          {!isAdmin ? (
            <p className={`mt-4 text-sm ${CRM_SURFACES.textMuted}`}>
              Solo un administrador puede editar el prompt.
            </p>
          ) : (
            <div className="mt-4 flex flex-wrap gap-2">
              <CrmButton
                type="button"
                variant="secondary"
                disabled={
                  isSavingPrompt || (isUsingDefault && !isDirty)
                }
                onClick={() => void handleRestoreDefault()}>
                Restaurar predeterminado
              </CrmButton>
              <CrmButton
                type="button"
                disabled={!isDirty || isOverLimit || isSavingPrompt}
                onClick={() => void handleSavePrompt()}>
                {isSavingPrompt ? "Guardando..." : "Guardar prompt"}
              </CrmButton>
            </div>
          )}
        </section>
      </div>
    </div>
  );
};
