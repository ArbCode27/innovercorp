"use client";

import { Sparkles, Workflow } from "lucide-react";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import type { BotEngine } from "../../_lib/types";
import {
  BOT_ENGINE_LABELS,
  resolveEffectiveBotEngine,
} from "../../_lib/bot-engine";
import { CrmButton } from "../shared/crm-button";

interface BotEngineSwitcherProps {
  humanMode: boolean;
  conversationBotEngine?: BotEngine | null;
  globalBotEngine: BotEngine;
  disabled?: boolean;
  onChange: (engine: BotEngine | null) => Promise<void>;
}

export const BotEngineSwitcher = ({
  humanMode,
  conversationBotEngine,
  globalBotEngine,
  disabled = false,
  onChange,
}: BotEngineSwitcherProps) => {
  const effective = resolveEffectiveBotEngine({
    conversationBotEngine,
    globalBotEngine,
  });
  const isOverride = conversationBotEngine === "gemini" || conversationBotEngine === "make";
  const label = isOverride
    ? BOT_ENGINE_LABELS[conversationBotEngine]
    : `${BOT_ENGINE_LABELS[effective]} (global)`;

  return (
    <DropdownMenu>
      <DropdownMenuTrigger asChild>
        <CrmButton
          type="button"
          variant="secondary"
          size="sm"
          disabled={disabled || humanMode}
          aria-label="Cambiar motor del bot"
          title={
            humanMode
              ? "El motor IA está pausado en modo agente"
              : `Motor actual: ${label}`
          }>
          {effective === "gemini" ? (
            <Sparkles className="size-3" aria-hidden="true" />
          ) : (
            <Workflow className="size-3" aria-hidden="true" />
          )}
          {humanMode ? "Motor pausado" : label}
        </CrmButton>
      </DropdownMenuTrigger>
      <DropdownMenuContent align="end" className="w-56">
        <DropdownMenuLabel>Motor de esta conversación</DropdownMenuLabel>
        <DropdownMenuSeparator />
        <DropdownMenuItem
          onClick={() => {
            void onChange(null);
          }}>
          Usar global ({BOT_ENGINE_LABELS[globalBotEngine]})
        </DropdownMenuItem>
        <DropdownMenuItem
          onClick={() => {
            void onChange("gemini");
          }}>
          <Sparkles className="mr-2 size-3.5" aria-hidden="true" />
          Gemini (backend)
        </DropdownMenuItem>
        <DropdownMenuItem
          onClick={() => {
            void onChange("make");
          }}>
          <Workflow className="mr-2 size-3.5" aria-hidden="true" />
          Make
        </DropdownMenuItem>
      </DropdownMenuContent>
    </DropdownMenu>
  );
};
