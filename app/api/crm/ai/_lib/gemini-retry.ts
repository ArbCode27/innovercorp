import {
  generateGeminiWithTools,
  GeminiApiError,
  type GeminiContent,
  type GeminiGenerateResult,
} from "./gemini";

const LOG_PREFIX = "[GEMINI_RETRY]";

export const isRetryableGeminiError = (error: unknown): boolean => {
  if (error instanceof GeminiApiError) {
    if (error.status != null) {
      if (error.status === 429) return true;
      if (error.status >= 500 && error.status <= 599) return true;
    }
    const statusText = String(error.statusText || "").toLowerCase();
    if (
      statusText.includes("unavailable") ||
      statusText.includes("resource_exhausted")
    ) {
      return true;
    }
  }

  if (!(error instanceof Error)) return false;
  const message = error.message.toLowerCase();
  const name = error.name.toLowerCase();

  return (
    name === "aborterror" ||
    name === "geminiapierror" ||
    message.includes("timeout") ||
    message.includes("abort") ||
    message.includes("fetch failed") ||
    message.includes("network") ||
    message.includes("econnreset") ||
    message.includes("etimedout") ||
    message.includes("429") ||
    message.includes("rate limit") ||
    message.includes("resource exhausted") ||
    message.includes("resource_exhausted") ||
    message.includes("503") ||
    message.includes("502") ||
    message.includes("500") ||
    message.includes("unavailable") ||
    message.includes("overloaded") ||
    message.includes("high demand") ||
    message.includes("try again later") ||
    message.includes("temporarily")
  );
};

/** Transient capacity/network errors that should soft-hold before human handoff. */
export const isTransientGeminiError = (error: unknown): boolean =>
  isRetryableGeminiError(error);

export const isTransientGeminiErrorMessage = (message: string | null | undefined) =>
  isRetryableGeminiError(new Error(String(message || "")));

const resolveBackoffMs = (error: unknown, attempt: number, baseMs: number) => {
  const message =
    error instanceof Error ? error.message.toLowerCase() : "";
  const status = error instanceof GeminiApiError ? error.status : null;
  const isCapacity =
    status === 429 ||
    status === 503 ||
    message.includes("high demand") ||
    message.includes("unavailable") ||
    message.includes("rate limit") ||
    message.includes("429") ||
    message.includes("503");

  const multiplier = isCapacity ? 2.5 : 1;
  return Math.round(baseMs * multiplier * Math.max(1, attempt));
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
  allowedToolNames?: string[] | null;
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
        const waitMs = resolveBackoffMs(lastError, attempt, backoffMs);
        console.warn(`${LOG_PREFIX} retrying`, {
          attempt: attempt + 1,
          maxAttempts: timeouts.length,
          timeoutMs,
          waitMs,
          model: input.model ?? null,
          ...input.logContext,
          previousError:
            lastError instanceof Error ? lastError.message : "unknown_error",
          previousStatus:
            lastError instanceof GeminiApiError ? lastError.status : null,
        });
        await sleep(waitMs);
      }

      return await generateGeminiWithTools({
        systemPrompt: input.systemPrompt,
        contents: input.contents,
        model: input.model,
        enableTools: input.enableTools,
        allowedToolNames: input.allowedToolNames,
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
        httpStatus: error instanceof GeminiApiError ? error.status : null,
        statusText:
          error instanceof GeminiApiError ? error.statusText : null,
        model: input.model ?? null,
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
