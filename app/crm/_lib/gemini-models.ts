/** Canonical Groq model ids used by Nova. */
export const DEFAULT_GROQ_MODEL = "openai/gpt-oss-20b";

/** Alternate chat model when the primary times out or saturates. */
export const DEFAULT_GROQ_FALLBACK_MODEL = "llama-3.3-70b-versatile";

/**
 * Vision model used only to describe images (receipts, IDs) as text before
 * the main agent (gpt-oss-20b is text-only).
 */
export const DEFAULT_GROQ_VISION_MODEL =
  "meta-llama/llama-4-scout-17b-16e-instruct";

/** Whisper model for voice-note transcription. */
export const DEFAULT_GROQ_WHISPER_MODEL = "whisper-large-v3-turbo";

/** @deprecated Use DEFAULT_GROQ_MODEL — kept for CRM column `gemini_model`. */
export const DEFAULT_GEMINI_MODEL = DEFAULT_GROQ_MODEL;

/** @deprecated Use DEFAULT_GROQ_FALLBACK_MODEL */
export const DEFAULT_GEMINI_FALLBACK_MODEL = DEFAULT_GROQ_FALLBACK_MODEL;

const RETIRED_MODELS = new Set([
  "gemini-3.6-flash",
  "gemini-3.5-flash",
  "gemini-2.5-flash",
  "gemini-2.5-pro",
  "gemini-2.5-flash-lite",
  "gemini-1.5-flash",
  "gemini-1.5-flash-8b",
  "gemini-1.5-pro",
]);

export const normalizeGeminiModelId = (model: string) =>
  model.trim().replace(/^models\//i, "");

export const normalizeGroqModelId = normalizeGeminiModelId;

export const isRetiredGeminiModel = (model: string) => {
  const normalized = normalizeGeminiModelId(model).toLowerCase();
  return (
    RETIRED_MODELS.has(normalized) || normalized.startsWith("gemini-")
  );
};
