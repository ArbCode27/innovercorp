import { z } from "zod";

export const LOOKUP_WISPRO_TOOL = "lookup_wispro_by_cedula";
export const LINK_WISPRO_TOOL = "link_wispro_client";
export const ESCALATE_HUMAN_TOOL = "escalate_to_human";
export const SUBMIT_PAYMENT_RECEIPT_TOOL = "submit_payment_receipt";

export const lookupWisproArgsSchema = z.object({
  cedula: z
    .string()
    .trim()
    .min(1, "cedula es requerida")
    .transform((value) => value.replace(/[^\d]/g, ""))
    .pipe(
      z
        .string()
        .min(5, "La cédula debe tener al menos 5 dígitos")
        .max(12, "La cédula no puede superar 12 dígitos")
        .regex(/^\d+$/, "La cédula solo puede contener números"),
    ),
});

export const linkWisproArgsSchema = z.object({
  wispro_id: z.string().trim().min(1, "wispro_id es requerido"),
});

export const escalateHumanArgsSchema = z.object({
  reason: z
    .string()
    .trim()
    .min(3, "reason debe tener al menos 3 caracteres")
    .max(500, "reason es demasiado largo"),
  message: z.string().trim().max(4096).optional().nullable(),
});

const coercePositiveNumber = z.union([z.number(), z.string()]).transform((value, ctx) => {
  if (typeof value === "number") {
    if (!Number.isFinite(value) || value <= 0) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        message: "Debe ser un número positivo",
      });
      return z.NEVER;
    }
    return value;
  }

  const normalized = value.replace(/,/g, ".").replace(/[^\d.]/g, "");
  const parsed = Number.parseFloat(normalized);
  if (!Number.isFinite(parsed) || parsed <= 0) {
    ctx.addIssue({
      code: z.ZodIssueCode.custom,
      message: "Debe ser un número positivo",
    });
    return z.NEVER;
  }
  return parsed;
});

const coerceTransactionCode = z.union([z.number(), z.string()]).transform((value, ctx) => {
  const digits =
    typeof value === "number"
      ? String(Math.trunc(value))
      : value.replace(/\D/g, "");

  if (!digits || digits.length < 1 || digits.length > 18) {
    ctx.addIssue({
      code: z.ZodIssueCode.custom,
      message: "transaction_code inválido",
    });
    return z.NEVER;
  }

  const parsed = Number(digits);
  if (!Number.isFinite(parsed) || parsed <= 0) {
    ctx.addIssue({
      code: z.ZodIssueCode.custom,
      message: "transaction_code inválido",
    });
    return z.NEVER;
  }

  return parsed;
});

export const submitPaymentReceiptArgsSchema = z.object({
  amount: coercePositiveNumber,
  transaction_code: coerceTransactionCode,
  bank: z.string().trim().min(2, "bank es requerido").max(80),
  wispro_id: z.string().trim().min(1).optional().nullable(),
  cedula: z
    .string()
    .trim()
    .transform((value) => value.replace(/[^\d]/g, ""))
    .optional()
    .nullable(),
  comment: z.string().trim().max(300).optional().nullable(),
});

/** Gemini functionDeclarations for the CRM agent. */
export const GEMINI_TOOL_DECLARATIONS = [
  {
    name: LOOKUP_WISPRO_TOOL,
    description:
      "Busca al abonado en Wispro por cédula/documento. Úsala cuando el usuario envíe su cédula o pida consultar su cuenta y aún no esté vinculado, o quiera verificar otra cédula.",
    parameters: {
      type: "object",
      properties: {
        cedula: {
          type: "string",
          description:
            "Cédula del cliente (solo dígitos; puedes limpiar V-, puntos o espacios).",
        },
      },
      required: ["cedula"],
    },
  },
  {
    name: LINK_WISPRO_TOOL,
    description:
      "Vincula un resultado de Wispro a ESTE chat de WhatsApp. Solo después de lookup_wispro_by_cedula. Si hubo un solo match, puedes vincularlo. Si hubo varios, confirma nombre/zona con el usuario antes de vincular.",
    parameters: {
      type: "object",
      properties: {
        wispro_id: {
          type: "string",
          description: "ID Wispro del match elegido (campo wispro_id del lookup).",
        },
      },
      required: ["wispro_id"],
    },
  },
  {
    name: SUBMIT_PAYMENT_RECEIPT_TOOL,
    description:
      "Registra un comprobante de pago en el API de pagos Innover. Úsala cuando el usuario envíe una captura/imagen de pago y ya hayas hecho lookup_wispro_by_cedula (no hace falta link previo). Extrae amount, transaction_code y bank solo si son legibles. No digas que el pago está aprobado; solo que quedó en revisión.",
    parameters: {
      type: "object",
      properties: {
        amount: {
          type: "number",
          description: "Monto del pago leído del comprobante.",
        },
        transaction_code: {
          type: "number",
          description:
            "Código/referencia de la transacción (solo dígitos) leído del comprobante.",
        },
        bank: {
          type: "string",
          description: "Banco del comprobante (origen o destino legible).",
        },
        wispro_id: {
          type: "string",
          description:
            "Opcional. wispro_id del match si hubo varios resultados en el lookup.",
        },
        cedula: {
          type: "string",
          description: "Opcional. Cédula si la tienes clara.",
        },
        comment: {
          type: "string",
          description: "Nota interna opcional.",
        },
      },
      required: ["amount", "transaction_code", "bank"],
    },
  },
  {
    name: ESCALATE_HUMAN_TOOL,
    description:
      "Escala la conversación a un asesor humano. Úsala si el cliente lo pide, hay un problema grave, o no puedes resolver con las tools.",
    parameters: {
      type: "object",
      properties: {
        reason: {
          type: "string",
          description: "Motivo breve interno del escalamiento.",
        },
        message: {
          type: "string",
          description:
            "Mensaje opcional para el cliente avisando que un asesor continuará.",
        },
      },
      required: ["reason"],
    },
  },
] as const;

export const GEMINI_TOOLS_CONTRACT_PROMPT = `Herramientas disponibles (obligatorio respetar):
1) lookup_wispro_by_cedula — cuando el usuario entregue cédula o pida datos de cuenta.
2) link_wispro_client — para vincular un match de Wispro a ESTE chat (opcional; no bloquea pagos).
3) submit_payment_receipt — cuando el usuario envíe un comprobante de pago (imagen). Requiere lookup previo con la cédula; NO exige link. Usa amount/transaction_code/bank legibles del comprobante.
4) escalate_to_human — para pasar a un asesor humano.

Reglas de identidad y pagos:
- Ya conoces el teléfono WhatsApp y el cliente CRM de ESTE chat (ver bloque Identidad).
- Para pagos: primero lookup_wispro_by_cedula; luego submit_payment_receipt con datos del match + del comprobante.
- Si el lookup tiene varios matches, confirma cuál es (o pasa wispro_id) antes de submit_payment_receipt.
- No inventes monto, referencia ni banco. Si no son legibles, pídelos al cliente.
- Nunca digas que el pago está aprobado; solo que fue recibido y quedó en revisión.
- Cuando termines (sin más tools), responde al cliente en texto claro por WhatsApp (sin JSON).`;
