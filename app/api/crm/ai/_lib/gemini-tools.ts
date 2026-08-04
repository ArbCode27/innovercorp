import { z } from "zod";
import {
  normalizeAmountToApiString,
  normalizeTransactionCodeToApiString,
} from "@/app/api/crm/_lib/innover-payments";

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
  /**
   * support → etiqueta Soporte + handoff al cerrar diagnóstico.
   * general → handoff sin etiqueta de soporte (cliente pide humano, etc.).
   */
  category: z.enum(["support", "general"]).optional().default("general"),
});

const optionalAmountSchema = z
  .union([z.number(), z.string()])
  .optional()
  .nullable()
  .transform((value, ctx) => {
    if (value === undefined || value === null || value === "") return null;
    const normalized = normalizeAmountToApiString(value);
    if (!normalized) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        message: "amount inválido",
      });
      return z.NEVER;
    }
    return normalized;
  });

const optionalTransactionCodeSchema = z
  .union([z.number(), z.string()])
  .optional()
  .nullable()
  .transform((value, ctx) => {
    if (value === undefined || value === null || value === "") return null;
    const normalized = normalizeTransactionCodeToApiString(value);
    if (!normalized) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        message: "transaction_code inválido",
      });
      return z.NEVER;
    }
    return normalized;
  });

export const submitPaymentReceiptArgsSchema = z.object({
  // Optional when pending_receipt was saved from a previous turn (image → then cedula).
  amount: optionalAmountSchema,
  transaction_code: optionalTransactionCodeSchema,
  bank: z.string().trim().min(2).max(80).optional().nullable(),
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
      "Busca al abonado en Wispro por cédula/documento. Úsala cuando el usuario envíe su cédula. Si el chat empezó con un comprobante, pide la cédula primero y luego usa esta tool.",
    parameters: {
      type: "object",
      properties: {
        cedula: {
          type: "string",
          description:
            "Cédula del cliente abonado Innover (solo dígitos; no uses la cédula del beneficiario del Tpago si no es el cliente).",
        },
      },
      required: ["cedula"],
    },
  },
  {
    name: LINK_WISPRO_TOOL,
    description:
      "Vincula un resultado de Wispro a ESTE chat. Opcional; no bloquea el registro de pagos.",
    parameters: {
      type: "object",
      properties: {
        wispro_id: {
          type: "string",
          description: "ID Wispro del match elegido.",
        },
      },
      required: ["wispro_id"],
    },
  },
  {
    name: SUBMIT_PAYMENT_RECEIPT_TOOL,
    description:
      "Registra el comprobante en el API de pagos Innover. Requiere lookup_wispro_by_cedula previo. Pasa amount/transaction_code/bank (texto) si los tienes; si ya se guardaron de una imagen anterior (pending_receipt), puedes omitirlos. Si aún no hay cédula, NO uses escalate: pide la cédula. Tras éxito o error del API el sistema hace handoff automático.",
    parameters: {
      type: "object",
      properties: {
        amount: {
          type: "string",
          description:
            "Monto del comprobante como texto (ej. 6687 o 6687.00). Acepta formato VE 6.687,00.",
        },
        transaction_code: {
          type: "string",
          description: "Referencia/código de transacción (solo dígitos) como texto.",
        },
        bank: {
          type: "string",
          description: "Banco del comprobante.",
        },
        wispro_id: {
          type: "string",
          description:
            "Opcional si hubo varios matches en el lookup.",
        },
        cedula: {
          type: "string",
          description: "Opcional. Cédula del abonado.",
        },
        comment: {
          type: "string",
          description: "Nota interna opcional.",
        },
      },
      required: [],
    },
  },
  {
    name: ESCALATE_HUMAN_TOOL,
    description:
      "Escala a un asesor humano. NO la uses solo porque llegó un comprobante. Para pagos, el handoff ocurre automáticamente después de submit_payment_receipt. En soporte técnico: cuando termines el diagnóstico y des el resumen al cliente, llama esta tool con category=support (el sistema etiqueta Soporte y hace handoff). Para pedido de humano u otros casos usa category=general.",
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
            "Mensaje para el cliente (en soporte: incluye el resumen breve del caso).",
        },
        category: {
          type: "string",
          enum: ["support", "general"],
          description:
            "support = cierre de caso técnico documentado. general = cliente pide humano u otro motivo.",
        },
      },
      required: ["reason", "category"],
    },
  },
] as const;

export const GEMINI_TOOLS_CONTRACT_PROMPT = `Herramientas disponibles (obligatorio respetar):
1) lookup_wispro_by_cedula — cuando el usuario entregue su cédula de abonado.
2) link_wispro_client — opcional; no bloquea pagos.
3) submit_payment_receipt — registrar comprobante (requiere lookup previo). amount y transaction_code como texto. Tras éxito o error el sistema etiqueta "Verificar pago" y hace handoff.
4) escalate_to_human — handoff a humano. category=support al cerrar diagnóstico técnico (con resumen). category=general si el cliente pide humano. NO al solo recibir un comprobante.

Flujo obligatorio de pagos:
1) Si llega imagen de comprobante SIN cédula: analiza la imagen y PIDE la cédula. No hagas handoff.
2) Cuando tengas cédula: lookup_wispro_by_cedula.
3) Luego submit_payment_receipt con monto/referencia/banco del comprobante.
4) El sistema hará handoff automático tras el POST (éxito o error). Tú solo confirma al cliente según el resultado de la tool.
5) Nunca digas que el pago está aprobado; solo recibido/en revisión o que un asesor continuará.

Flujo obligatorio de soporte técnico:
1) Identifica (cédula si falta) y haz preguntas de diagnóstico breves.
2) Cuando tengas lo necesario: resume el caso al cliente en el message de escalate_to_human.
3) Llama escalate_to_human con category=support (el sistema etiqueta Soporte y hace handoff).
4) No des pasos de reparación ni cierres el caso como resuelto.

Reglas:
- No inventes monto, referencia ni banco.
- Si hay varios matches Wispro, confirma cuál es antes del submit.
- Responde siempre en texto claro por WhatsApp (sin JSON).`;
