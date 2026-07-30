export type BotEngine = "gemini" | "make";

export const BOT_ENGINES = ["gemini", "make"] as const;

export const DEFAULT_BOT_ENGINE: BotEngine = "make";

export const BOT_ENGINE_LABELS: Record<BotEngine, string> = {
  gemini: "Gemini (backend)",
  make: "Make",
};

export const isBotEngine = (value: unknown): value is BotEngine =>
  value === "gemini" || value === "make";

export const normalizeBotEngine = (
  value: unknown,
  fallback: BotEngine = DEFAULT_BOT_ENGINE,
): BotEngine => (isBotEngine(value) ? value : fallback);

export const resolveEffectiveBotEngine = (input: {
  conversationBotEngine?: string | null;
  globalBotEngine?: string | null;
}): BotEngine => {
  if (isBotEngine(input.conversationBotEngine)) {
    return input.conversationBotEngine;
  }

  return normalizeBotEngine(input.globalBotEngine);
};

/**
 * Hard gate: Make is only notified when bot mode is active AND engine is Make.
 * Gemini conversations must never trigger MAKE_WEBHOOK_URL calls.
 */
export const shouldNotifyMake = (input: {
  humanMode?: boolean | null;
  conversationBotEngine?: string | null;
  globalBotEngine?: string | null;
}): boolean => {
  if (input.humanMode === true) return false;

  return (
    resolveEffectiveBotEngine({
      conversationBotEngine: input.conversationBotEngine,
      globalBotEngine: input.globalBotEngine,
    }) === "make"
  );
};
