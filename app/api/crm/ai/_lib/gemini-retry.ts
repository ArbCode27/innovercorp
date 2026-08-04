import {
  generateGeminiWithTools,
  type GeminiContent,
  type GeminiGenerateResult,
} from "./gemini";

const LOG_PREFIX = "[GEMINI_RETRY]";

export const isRetryableGeminiError = (error: unknown): boolean => {
  if (!(error instanceof Error)) return false;
  const message = error.message.toLowerCase();
  const name = error.name.toLowerCase();

  return (
    name === "aborterror" ||
    message.includes("timeout") ||
    message.includes("abort") ||
    message.includes("fetch failed") ||
    message.includes("network") ||
    message.includes("econnreset") ||
    message.includes("etimedout") ||
    message.includes("429") ||
    message.includes("rate limit") ||
    message.includes("resource exhausted") ||
    message.includes("503") ||
    message.includes("502") ||
    message.includes("500") ||
    message.includes("unavailable") ||
    message.includes("overloaded")
  );
};

const sleep = (ms: number) =>
  new Promise<void>((resolve) => {
    setTimeout(resolve, ms);
  });

/**
 * Retries Gemini generateContent on transient failures (timeouts, 5xx, rate limits).
 */
export const generateGeminiWithRetry = async (input: {
  systemPrompt: string;
  contents: GeminiContent[];
  model?: string;
  enableTools?: boolean;
  /** Per-attempt timeouts in ms (length = max attempts). */
  timeoutsMs: number[];
  backoffMs?: number;
  logContext?: Record<string, unknown>;
}): Promise<GeminiGenerateResult> => {
  const timeouts = input.timeoutsMs.filter((value) => value > 0);
  if (!timeouts.length) {
    throw new Error("timeoutsMs vacío");
  }

  const backoffMs = input.backoffMs ?? 1500;
  let lastError: unknown = null;

  for (let attempt = 0; attempt < timeouts.length; attempt += 1) {
    const timeoutMs = timeouts[attempt];
    try {
      if (attempt > 0) {
        console.warn(`${LOG_PREFIX} retrying`, {
          attempt: attempt + 1,
          maxAttempts: timeouts.length,
          timeoutMs,
          ...input.logContext,
          previousError:
            lastError instanceof Error ? lastError.message : "unknown_error",
        });
        await sleep(backoffMs * attempt);
      }

      return await generateGeminiWithTools({
        systemPrompt: input.systemPrompt,
        contents: input.contents,
        model: input.model,
        enableTools: input.enableTools,
        timeoutMs,
      });
    } catch (error) {
      lastError = error;
      const retryable = isRetryableGeminiError(error);
      console.warn(`${LOG_PREFIX} attempt_failed`, {
        attempt: attempt + 1,
        maxAttempts: timeouts.length,
        timeoutMs,
        retryable,
        error: error instanceof Error ? error.message : "unknown_error",
        ...input.logContext,
      });

      if (!retryable || attempt >= timeouts.length - 1) {
        throw error;
      }
    }
  }

  throw lastError instanceof Error
    ? lastError
    : new Error("Gemini falló tras reintentos");
};

/** Removes inlineData parts so a degraded retry is text-only (faster). */
export const stripInlineMediaFromContents = (
  contents: GeminiContent[],
): GeminiContent[] =>
  contents.map((content) => ({
    role: content.role,
    parts: content.parts
      .map((part) => {
        if ("inlineData" in part && part.inlineData) {
          return { text: "[Imagen/audio adjunto omitido en reintento]" };
        }
        return part;
      })
      .filter((part) => {
        if ("text" in part && typeof part.text === "string") {
          return part.text.trim().length > 0;
        }
        return true;
      }),
  }));
