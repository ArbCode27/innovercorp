type GeminiGenerateResult = {
  text: string;
  raw: unknown;
};

type GeminiContentPart = { text: string };

type GeminiContent = {
  role: "user" | "model";
  parts: GeminiContentPart[];
};

const LOG_PREFIX = "[GEMINI]";
const DEFAULT_MODEL = "gemini-2.0-flash";

export const getGeminiApiKey = () => {
  const key =
    process.env.GEMINI_API_KEY?.trim() ||
    process.env.GOOGLE_AI_API_KEY?.trim() ||
    process.env.GOOGLE_GENERATIVE_AI_API_KEY?.trim() ||
    "";

  return key || null;
};

export const generateGeminiText = async (input: {
  systemPrompt: string;
  contents: GeminiContent[];
  model?: string;
  timeoutMs?: number;
}): Promise<GeminiGenerateResult> => {
  const apiKey = getGeminiApiKey();
  if (!apiKey) {
    console.error(`${LOG_PREFIX} missing_api_key`, {
      hint: "Configura GEMINI_API_KEY en .env y reinicia el servidor",
    });
    throw new Error("GEMINI_API_KEY no está configurada en el servidor");
  }

  const model = (input.model || DEFAULT_MODEL).trim() || DEFAULT_MODEL;
  const controller = new AbortController();
  const timeoutMs = input.timeoutMs ?? 15000;
  const timeout = setTimeout(() => controller.abort(), timeoutMs);

  console.log(`${LOG_PREFIX} request_started`, {
    model,
    contentsCount: input.contents.length,
    timeoutMs,
    apiKeyPresent: true,
    apiKeyPrefix: `${apiKey.slice(0, 6)}...`,
  });

  try {
    const response = await fetch(
      `https://generativelanguage.googleapis.com/v1beta/models/${encodeURIComponent(
        model,
      )}:generateContent?key=${encodeURIComponent(apiKey)}`,
      {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        signal: controller.signal,
        body: JSON.stringify({
          systemInstruction: {
            parts: [{ text: input.systemPrompt }],
          },
          contents: input.contents,
          generationConfig: {
            temperature: 0.4,
            maxOutputTokens: 512,
            responseMimeType: "application/json",
          },
        }),
      },
    );

    const raw = await response.json();
    console.log(`${LOG_PREFIX} raw_response`, {
      model,
      ok: response.ok,
      status: response.status,
      raw,
    });

    if (!response.ok) {
      const message =
        raw?.error?.message ||
        `Gemini respondió con estado ${response.status}`;
      console.error(`${LOG_PREFIX} api_error`, {
        model,
        status: response.status,
        code: raw?.error?.code ?? null,
        statusText: raw?.error?.status ?? null,
        message,
      });
      throw new Error(message);
    }

    const text = String(
      raw?.candidates?.[0]?.content?.parts
        ?.map((part: { text?: string }) => part?.text || "")
        .join("") || "",
    ).trim();

    const finishReason = raw?.candidates?.[0]?.finishReason ?? null;
    console.log(`${LOG_PREFIX} text_response`, {
      model,
      text,
      finishReason,
      hasText: Boolean(text),
    });

    if (!text) {
      console.error(`${LOG_PREFIX} empty_text`, {
        model,
        finishReason,
        candidates: raw?.candidates ?? null,
      });
      throw new Error("Gemini no devolvió texto útil");
    }

    return { text, raw };
  } catch (error) {
    const isAbort =
      error instanceof Error &&
      (error.name === "AbortError" ||
        error.message.toLowerCase().includes("abort"));

    console.error(`${LOG_PREFIX} request_failed`, {
      model,
      isTimeout: isAbort,
      timeoutMs,
      error: error instanceof Error ? error.message : "unknown_error",
      name: error instanceof Error ? error.name : typeof error,
    });

    if (isAbort) {
      throw new Error(
        `Gemini timeout: no respondió en ${timeoutMs}ms (modelo ${model})`,
      );
    }

    throw error;
  } finally {
    clearTimeout(timeout);
  }
};

export type GeminiReplyDecision = {
  action: "reply" | "handoff";
  message: string;
  reason?: string;
};

export const parseGeminiReplyDecision = (
  rawText: string,
): GeminiReplyDecision => {
  const trimmed = rawText.trim();
  const jsonMatch = trimmed.match(/\{[\s\S]*\}/);
  const candidate = jsonMatch?.[0] || trimmed;

  try {
    const parsed = JSON.parse(candidate) as {
      action?: string;
      message?: string;
      reason?: string;
    };

    const action = parsed.action === "handoff" ? "handoff" : "reply";
    const message = String(parsed.message || "").trim();

    if (!message && action === "reply") {
      throw new Error("Respuesta vacía");
    }

    return {
      action,
      message:
        message ||
        "Un asesor de nuestro equipo continuará contigo en breve.",
      reason: parsed.reason ? String(parsed.reason) : undefined,
    };
  } catch (parseError) {
    console.warn(`${LOG_PREFIX} decision_parse_fallback`, {
      parseError:
        parseError instanceof Error ? parseError.message : "parse_failed",
      rawTextPreview: trimmed.slice(0, 280),
    });

    const lower = trimmed.toLowerCase();
    const wantsHandoff =
      lower.includes("asesor") &&
      (lower.includes("humano") ||
        lower.includes("transfer") ||
        lower.includes("deriv"));

    return {
      action: wantsHandoff ? "handoff" : "reply",
      message:
        trimmed ||
        "Un asesor de nuestro equipo continuará contigo en breve.",
    };
  }
};
