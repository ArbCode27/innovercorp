import { GEMINI_TOOL_DECLARATIONS } from "./gemini-tools";

export class GeminiApiError extends Error {
  status: number | null;
  statusText: string | null;

  constructor(
    message: string,
    status?: number | null,
    statusText?: string | null,
  ) {
    const statusPrefix =
      status != null
        ? `Gemini ${status}${statusText ? ` ${statusText}` : ""}: `
        : "Gemini: ";
    super(`${statusPrefix}${message}`);
    this.name = "GeminiApiError";
    this.status = status ?? null;
    this.statusText = statusText ?? null;
  }
}

export type GeminiContentPart =
  | { text: string }
  | {
      inlineData: {
        mimeType: string;
        data: string;
      };
    }
  | {
      functionCall: {
        name: string;
        args?: Record<string, unknown>;
      };
    }
  | {
      functionResponse: {
        name: string;
        response: Record<string, unknown>;
      };
    };

export type GeminiContent = {
  role: "user" | "model";
  parts: GeminiContentPart[];
};

export type GeminiFunctionCall = {
  name: string;
  args: Record<string, unknown>;
};

export type GeminiGenerateResult = {
  text: string;
  raw: unknown;
  functionCalls: GeminiFunctionCall[];
  modelContent: GeminiContent | null;
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

const extractFunctionCalls = (raw: unknown): GeminiFunctionCall[] => {
  const parts =
    (raw as { candidates?: Array<{ content?: { parts?: unknown[] } }> })
      ?.candidates?.[0]?.content?.parts || [];

  const calls: GeminiFunctionCall[] = [];

  for (const part of parts) {
    if (!part || typeof part !== "object") continue;
    const functionCall = (part as { functionCall?: unknown }).functionCall;
    if (!functionCall || typeof functionCall !== "object") continue;

    const name = String(
      (functionCall as { name?: unknown }).name || "",
    ).trim();
    if (!name) continue;

    const argsRaw = (functionCall as { args?: unknown }).args;
    const args =
      argsRaw && typeof argsRaw === "object" && !Array.isArray(argsRaw)
        ? (argsRaw as Record<string, unknown>)
        : {};

    calls.push({ name, args });
  }

  return calls;
};

const extractText = (raw: unknown) =>
  String(
    (raw as { candidates?: Array<{ content?: { parts?: Array<{ text?: string }> } }> })
      ?.candidates?.[0]?.content?.parts
      ?.map((part) => part?.text || "")
      .join("") || "",
  ).trim();

const extractModelContent = (raw: unknown): GeminiContent | null => {
  const content = (
    raw as { candidates?: Array<{ content?: { role?: string; parts?: unknown[] } }> }
  )?.candidates?.[0]?.content;

  if (!content?.parts || !Array.isArray(content.parts) || !content.parts.length) {
    return null;
  }

  return {
    role: "model",
    parts: content.parts as GeminiContentPart[],
  };
};

export const generateGeminiWithTools = async (input: {
  systemPrompt: string;
  contents: GeminiContent[];
  model?: string;
  timeoutMs?: number;
  enableTools?: boolean;
  /** When set, only these tool names are exposed to Gemini. */
  allowedToolNames?: string[] | null;
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
  const timeoutMs = input.timeoutMs ?? 25000;
  const timeout = setTimeout(() => controller.abort(), timeoutMs);
  const enableTools = input.enableTools ?? true;

  const toolDeclarations =
    input.allowedToolNames && input.allowedToolNames.length
      ? GEMINI_TOOL_DECLARATIONS.filter((tool) =>
          input.allowedToolNames!.includes(tool.name),
        )
      : GEMINI_TOOL_DECLARATIONS;

  console.log(`${LOG_PREFIX} request_started`, {
    model,
    contentsCount: input.contents.length,
    timeoutMs,
    enableTools,
    toolsCount: enableTools ? toolDeclarations.length : 0,
    apiKeyPresent: true,
    apiKeyPrefix: `${apiKey.slice(0, 6)}...`,
  });

  try {
    const body: Record<string, unknown> = {
      systemInstruction: {
        parts: [{ text: input.systemPrompt }],
      },
      contents: input.contents,
      generationConfig: {
        temperature: 0.4,
        maxOutputTokens: 1024,
      },
    };

    if (enableTools && toolDeclarations.length > 0) {
      body.tools = [
        {
          functionDeclarations: toolDeclarations,
        },
      ];
      body.toolConfig = {
        functionCallingConfig: {
          mode: "AUTO",
        },
      };
    }

    const response = await fetch(
      `https://generativelanguage.googleapis.com/v1beta/models/${encodeURIComponent(
        model,
      )}:generateContent?key=${encodeURIComponent(apiKey)}`,
      {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        signal: controller.signal,
        body: JSON.stringify(body),
      },
    );

    const raw = await response.json();
    const functionCalls = extractFunctionCalls(raw);
    const text = extractText(raw);
    const modelContent = extractModelContent(raw);

    console.log(`${LOG_PREFIX} raw_response`, {
      model,
      ok: response.ok,
      status: response.status,
      functionCallCount: functionCalls.length,
      hasText: Boolean(text),
      finishReason: raw?.candidates?.[0]?.finishReason ?? null,
    });

    if (!response.ok) {
      const message =
        raw?.error?.message ||
        `Gemini respondió con estado ${response.status}`;
      const statusText =
        typeof raw?.error?.status === "string" ? raw.error.status : null;
      console.error(`${LOG_PREFIX} api_error`, {
        model,
        status: response.status,
        code: raw?.error?.code ?? null,
        statusText,
        message,
      });
      throw new GeminiApiError(message, response.status, statusText);
    }

    if (!functionCalls.length && !text) {
      console.error(`${LOG_PREFIX} empty_response`, {
        model,
        finishReason: raw?.candidates?.[0]?.finishReason ?? null,
        candidates: raw?.candidates ?? null,
      });
      throw new Error("Gemini no devolvió texto ni function calls");
    }

    return { text, raw, functionCalls, modelContent };
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

/** @deprecated Prefer generateGeminiWithTools for the agent path. */
export const generateGeminiText = async (input: {
  systemPrompt: string;
  contents: GeminiContent[];
  model?: string;
  timeoutMs?: number;
}): Promise<{ text: string; raw: unknown }> => {
  const result = await generateGeminiWithTools({
    ...input,
    enableTools: false,
    timeoutMs: input.timeoutMs ?? 15000,
  });

  if (!result.text) {
    throw new Error("Gemini no devolvió texto útil");
  }

  return { text: result.text, raw: result.raw };
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
