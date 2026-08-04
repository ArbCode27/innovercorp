/** Sole AI engine for the CRM bot. Make was removed. */
export type BotEngine = "gemini";

export const BOT_ENGINES = ["gemini"] as const;

export const DEFAULT_BOT_ENGINE: BotEngine = "gemini";

export const BOT_ENGINE_LABELS: Record<BotEngine, string> = {
  gemini: "Gemini",
};

export const isBotEngine = (value: unknown): value is BotEngine =>
  value === "gemini";

/** Legacy DB values like "make" normalize to Gemini. */
export const normalizeBotEngine = (_value?: unknown): BotEngine =>
  DEFAULT_BOT_ENGINE;
