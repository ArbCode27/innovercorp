type GeminiGenerateResult = {
  text: string;
  raw: unknown;
};

type GeminiContentPart = { text: string };

type GeminiContent = {
  role: "user" | "model";
  parts: GeminiContentPart[];
};

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
    throw new Error("GEMINI_API_KEY no está configurada en el servidor");
  }

  const model = (input.model || DEFAULT_MODEL).trim() || DEFAULT_MODEL;
  const controller = new AbortController();
  const timeout = setTimeout(
    () => controller.abort(),
    input.timeoutMs ?? 15000,
  );

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
    console.log("[GEMINI] raw_response", {
      model,
      ok: response.ok,
      status: response.status,
      raw,
    });

    if (!response.ok) {
      const message =
        raw?.error?.message ||
        `Gemini respondió con estado ${response.status}`;
      throw new Error(message);
    }

    const text = String(
      raw?.candidates?.[0]?.content?.parts
        ?.map((part: { text?: string }) => part?.text || "")
        .join("") || "",
    ).trim();

    console.log("[GEMINI] text_response", { model, text });

    if (!text) {
      throw new Error("Gemini no devolvió texto útil");
    }

    return { text, raw };
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
  } catch {
    // Fallback: treat plain text as a reply unless handoff keywords appear.
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
