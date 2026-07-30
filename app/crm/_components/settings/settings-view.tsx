"use client";

import { Settings2, Sparkles, Workflow } from "lucide-react";
import type { Agent, BotEngine, CrmSettings } from "../../_lib/types";
import { BOT_ENGINE_LABELS } from "../../_lib/bot-engine";
import { isAdminRole } from "../../_lib/agent-role-utils";
import { CRM_SURFACES } from "../../_lib/crm-theme";
import { CrmButton } from "../shared/crm-button";

interface SettingsViewProps {
  currentAgent: Agent;
  settings: CrmSettings;
  onUpdateGlobalBotEngine: (engine: BotEngine) => Promise<void>;
}

export const SettingsView = ({
  currentAgent,
  settings,
  onUpdateGlobalBotEngine,
}: SettingsViewProps) => {
  const isAdmin = isAdminRole(currentAgent.role);

  const handleSelect = async (engine: BotEngine) => {
    if (!isAdmin || engine === settings.bot_engine) return;
    await onUpdateGlobalBotEngine(engine);
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
          Configura el motor que responde automáticamente cuando el bot está activo
        </p>
      </div>

      <section
        className={`max-w-2xl rounded-xl border p-4 md:p-5 ${CRM_SURFACES.border} ${CRM_SURFACES.elevated}`}>
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
    </div>
  );
};
