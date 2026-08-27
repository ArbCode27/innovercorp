/** Canonical Gemini model ids used by Nova. */
export const DEFAULT_GEMINI_MODEL = "gemini-3.6-flash";

/** Alternate model when the primary times out or saturates. */
export const DEFAULT_GEMINI_FALLBACK_MODEL = "gemini-3.5-flash";

const RETIRED_GEMINI_MODELS = new Set([
  "gemini-2.5-flash",
  "gemini-2.5-pro",
  "gemini-2.5-flash-lite",
  "gemini-1.5-flash",
  "gemini-1.5-flash-8b",
  "gemini-1.5-pro",
]);

export const normalizeGeminiModelId = (model: string) =>
  model.trim().replace(/^models\//i, "");

export const isRetiredGeminiModel = (model: string) =>
  RETIRED_GEMINI_MODELS.has(normalizeGeminiModelId(model).toLowerCase());
