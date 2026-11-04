import {
  DEFAULT_GROQ_VISION_MODEL,
} from "@/app/crm/_lib/ai-models";
import {
  getBcvRate,
  roundMoney,
} from "@/app/api/crm/_lib/dolarvzla-rate";
import { normalizeReceptorBank } from "@/app/crm/_lib/payments";

const LOG_PREFIX = "[RECEIPT_EXTRACTOR]";
const GROQ_CHAT_URL = "https://api.groq.com/openai/v1/chat/completions";
const IMAGE_MAX_BYTES = 10 * 1024 * 1024; // 10MB

export type ExtractedReceiptData = {
  amountBs: number | null;
  amountUsd: number | null;
  bcvRate: number;
  bcvAsOf: string;
  currency: "VES" | "USD";
  transactionCode: string | null;
  paymentDate: string;
  bank: string | null;
  originBank: string | null;
  senderPhone: string | null;
  senderCedula: string | null;
  confidence: "high" | "medium" | "low";
  summary: string;
  suggestedFromChat?: boolean;
};

const getGroqApiKey = () => process.env.GROQ_API_KEY?.trim() || "";

const getTodayInCaracas = () =>
  new Intl.DateTimeFormat("en-CA", {
    timeZone: "America/Caracas",
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  }).format(new Date());

export const parseReceiptAmount = (value: unknown): number | null => {
  if (typeof value === "number") {
    return Number.isFinite(value) && value > 0 ? roundMoney(value, 2) : null;
  }
  if (typeof value !== "string") return null;

  const raw = value.trim().replace(/[^\d.,]/g, "");
  if (!raw) return null;

  let normalized = raw;
  if (normalized.includes(",") && normalized.includes(".")) {
    const lastComma = normalized.lastIndexOf(",");
    const lastDot = normalized.lastIndexOf(".");
    if (lastComma > lastDot) {
      // 26.796,30 -> 26796.30
      normalized = normalized.replace(/\./g, "").replace(",", ".");
    } else {
      // 26,796.30 -> 26796.30
      normalized = normalized.replace(/,/g, "");
    }
  } else if (normalized.includes(",")) {
    // 26796,30 -> 26796.30
    normalized = normalized.replace(",", ".");
  }

  const parsed = Number.parseFloat(normalized);
  return Number.isFinite(parsed) && parsed > 0 ? roundMoney(parsed, 2) : null;
};

export const parseReceiptTransactionCode = (value: unknown): string | null => {
  if (typeof value === "number") return String(Math.trunc(value));
  if (typeof value !== "string") return null;

  const digits = value.replace(/\D/g, "");
  return digits.length >= 3 ? digits : null;
};

export const parseReceiptDate = (value: unknown): string | null => {
  if (typeof value !== "string") return null;
  const trimmed = value.trim();

  // Match DD/MM/YYYY or DD-MM-YYYY
  const dmyMatch = trimmed.match(/^(\d{1,2})[/-](\d{1,2})[/-](\d{2,4})$/);
  if (dmyMatch) {
    const day = dmyMatch[1].padStart(2, "0");
    const month = dmyMatch[2].padStart(2, "0");
    let year = dmyMatch[3];
    if (year.length === 2) year = `20${year}`;
    return `${year}-${month}-${day}`;
  }

  // Match YYYY-MM-DD
  const ymdMatch = trimmed.match(/^(\d{4})[/-](\d{1,2})[/-](\d{1,2})/);
  if (ymdMatch) {
    const year = ymdMatch[1];
    const month = ymdMatch[2].padStart(2, "0");
    const day = ymdMatch[3].padStart(2, "0");
    return `${year}-${month}-${day}`;
  }

  return null;
};

export const detectBankFromText = (text: string): string | null => {
  const lower = text.toLowerCase();
  if (lower.includes("bancamiga") || lower.includes("amiga")) return "Bancamiga";
  if (lower.includes("venezuela") || lower.includes("bdv")) return "Banco de Venezuela";
  if (lower.includes("banplus")) return "Banplus";
  if (lower.includes("banesco")) return "Banesco";
  if (lower.includes("mercantil")) return "Mercantil";
  if (lower.includes("provincial")) return "Provincial";
  return null;
};

const SYSTEM_RECEIPT_PROMPT = `Eres un auditor experto en comprobantes bancarios venezolanos (Pago Móvil, Transferencias Banesco, Banco de Venezuela, Bancamiga, Banplus, Mercantil, Provincial).
Tu tarea es interpretar la imagen del comprobante de pago y extraer sus datos en un objeto JSON estricto.

CAMPOS A EXTRAER:
1. "amount": Monto numérico del comprobante (ej: 26796.30). Si tiene formato venezolano "26.796,30", conviértelo a float 26796.30.
2. "currency": "VES" si el pago es en bolívares (Bs. / Bs), o "USD" si es en dólares.
3. "transaction_code": Código de referencia o número de comprobante (solo dígitos, ej: "63082316683").
4. "payment_date": Fecha de la transacción en formato YYYY-MM-DD (ej: "2026-11-04").
5. "bank": BANCO RECEPTOR / DESTINO de la empresa (la cuenta donde se depositó el dinero).
   - REGLA CRÍTICA: Los bancos receptores de la empresa suelen ser: "Bancamiga", "Banco de Venezuela", o "Banplus".
   - Si el comprobante dice "Banesco Pago Móvil", ese es el banco emisor (origen), NO necesariamente el receptor.
   - Si el comprobante no menciona el banco receptor, pero en el contexto del chat provisto el cliente o bot mencionan "Bancamiga" o "Venezuela", usa ese banco.
   - Si no está seguro, responde null.
6. "origin_bank": Banco desde donde pagó el cliente (ej: "Banesco", "Mercantil", etc.).
7. "sender_phone": Teléfono emisor si aparece en el comprobante.
8. "sender_cedula": Cédula o RIF del emisor si aparece.
9. "confidence": "high" | "medium" | "low".
10. "summary": Breve descripción (ej: "Pago Móvil Banesco a Bancamiga por Bs. 26.796,30").

RESPONDE ÚNICAMENTE CON EL OBJETO JSON VÁLIDO.`;

export const extractPaymentReceiptWithAi = async (input: {
  imageUrl: string;
  chatContextText?: string | null;
  timeoutMs?: number;
}): Promise<ExtractedReceiptData> => {
  const today = getTodayInCaracas();

  // Fetch current BCV rate
  let bcvRate = 1.0;
  let bcvAsOf = today;
  try {
    const rateSnapshot = await getBcvRate();
    bcvRate = rateSnapshot.rate;
    bcvAsOf = rateSnapshot.asOf;
  } catch (rateError) {
    console.warn(`${LOG_PREFIX} bcv_rate_fetch_failed`, rateError);
  }

  // Check if bank was mentioned in chat context
  const bankFromChat = input.chatContextText
    ? detectBankFromText(input.chatContextText)
    : null;

  const fallbackData: ExtractedReceiptData = {
    amountBs: null,
    amountUsd: null,
    bcvRate,
    bcvAsOf,
    currency: "VES",
    transactionCode: null,
    paymentDate: today,
    bank: bankFromChat,
    originBank: null,
    senderPhone: null,
    senderCedula: null,
    confidence: "low",
    summary: bankFromChat
      ? `Banco sugerido por conversación: ${bankFromChat}`
      : "No se pudo interpretar automáticamente la imagen",
    suggestedFromChat: Boolean(bankFromChat),
  };

  const apiKey = getGroqApiKey();
  if (!apiKey) {
    console.warn(`${LOG_PREFIX} groq_api_key_missing`);
    return fallbackData;
  }

  try {
    // Download image bytes
    const response = await fetch(input.imageUrl, {
      method: "GET",
      cache: "no-store",
      signal: AbortSignal.timeout(input.timeoutMs ?? 20_000),
    });

    if (!response.ok) {
      console.warn(`${LOG_PREFIX} image_download_failed`, {
        status: response.status,
      });
      return fallbackData;
    }

    const buffer = Buffer.from(await response.arrayBuffer());
    if (!buffer.length || buffer.byteLength > IMAGE_MAX_BYTES) {
      console.warn(`${LOG_PREFIX} invalid_image_buffer`, {
        bytes: buffer.byteLength,
      });
      return fallbackData;
    }

    const contentType =
      response.headers.get("content-type") || "image/jpeg";
    const dataUrl = `data:${contentType};base64,${buffer.toString("base64")}`;

    const model =
      process.env.GROQ_VISION_MODEL?.trim() || DEFAULT_GROQ_VISION_MODEL;

    const userPromptContent: Array<
      | { type: "text"; text: string }
      | { type: "image_url"; image_url: { url: string } }
    > = [
      {
        type: "text",
        text: input.chatContextText
          ? `Interpreta este comprobante bancario adjunto.\n\nContexto de mensajes en el chat de WhatsApp del cliente:\n"""\n${input.chatContextText}\n"""\n\nExtrae los datos en formato JSON.`
          : "Interpreta este comprobante bancario adjunto y extrae los datos en formato JSON.",
      },
      {
        type: "image_url",
        image_url: { url: dataUrl },
      },
    ];

    const visionResponse = await fetch(GROQ_CHAT_URL, {
      method: "POST",
      headers: {
        Authorization: `Bearer ${apiKey}`,
        "Content-Type": "application/json",
      },
      signal: AbortSignal.timeout(input.timeoutMs ?? 25_000),
      body: JSON.stringify({
        model,
        temperature: 0.1,
        max_tokens: 800,
        response_format: { type: "json_object" },
        messages: [
          { role: "system", content: SYSTEM_RECEIPT_PROMPT },
          { role: "user", content: userPromptContent },
        ],
      }),
    });

    if (!visionResponse.ok) {
      const errText = await visionResponse.text();
      console.warn(`${LOG_PREFIX} vision_api_error`, {
        status: visionResponse.status,
        body: errText,
      });
      return fallbackData;
    }

    const visionRaw = await visionResponse.json();
    const content = String(
      visionRaw?.choices?.[0]?.message?.content || "",
    ).trim();

    const jsonMatch = content.match(/\{[\s\S]*\}/);
    if (!jsonMatch) {
      console.warn(`${LOG_PREFIX} no_json_in_response`, { content });
      return fallbackData;
    }

    const parsed = JSON.parse(jsonMatch[0]) as Record<string, unknown>;

    const amountNum = parseReceiptAmount(parsed.amount);
    const currency =
      String(parsed.currency || "").toUpperCase() === "USD" ? "USD" : "VES";
    const transactionCode = parseReceiptTransactionCode(
      parsed.transaction_code,
    );
    const paymentDate = parseReceiptDate(parsed.payment_date) || today;

    const rawBank =
      typeof parsed.bank === "string" && parsed.bank.trim()
        ? parsed.bank.trim()
        : bankFromChat;
    const normalizedBank = normalizeReceptorBank(rawBank) || rawBank || null;

    const originBank =
      typeof parsed.origin_bank === "string" ? parsed.origin_bank.trim() : null;
    const senderPhone =
      typeof parsed.sender_phone === "string"
        ? parsed.sender_phone.trim()
        : null;
    const senderCedula =
      typeof parsed.sender_cedula === "string"
        ? parsed.sender_cedula.replace(/\D/g, "")
        : null;

    let amountBs: number | null = null;
    let amountUsd: number | null = null;

    if (amountNum != null) {
      if (currency === "USD") {
        amountUsd = amountNum;
        amountBs = roundMoney(amountNum * bcvRate, 2);
      } else {
        amountBs = amountNum;
        amountUsd = roundMoney(amountNum / bcvRate, 2);
      }
    }

    const confidence: "high" | "medium" | "low" =
      amountNum && transactionCode && normalizedBank
        ? "high"
        : amountNum || transactionCode
          ? "medium"
          : "low";

    const summary =
      typeof parsed.summary === "string" && parsed.summary.trim()
        ? parsed.summary.trim()
        : `Comprobante ${normalizedBank || ""} ${amountBs ? `Bs. ${amountBs}` : ""}`;

    return {
      amountBs,
      amountUsd,
      bcvRate,
      bcvAsOf,
      currency,
      transactionCode,
      paymentDate,
      bank: normalizedBank,
      originBank,
      senderPhone,
      senderCedula,
      confidence,
      summary,
      suggestedFromChat: Boolean(!parsed.bank && bankFromChat),
    };
  } catch (error) {
    console.error(`${LOG_PREFIX} extraction_exception`, error);
    return fallbackData;
  }
};
