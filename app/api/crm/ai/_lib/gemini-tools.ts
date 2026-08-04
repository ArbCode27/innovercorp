import { z } from "zod";
import {
  normalizeAmountToApiString,
  normalizeTransactionCodeToApiString,
} from "@/app/api/crm/_lib/innover-payments";

export const LOOKUP_WISPRO_TOOL = "lookup_wispro_by_cedula";
export const LINK_WISPRO_TOOL = "link_wispro_client";
export const ESCALATE_HUMAN_TOOL = "escalate_to_human";
export const SUBMIT_PAYMENT_RECEIPT_TOOL = "submit_payment_receipt";
export const GET_BCV_RATE_TOOL = "get_bcv_rate";

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
      "Busca al abonado en Wispro por cédula/documento. Devuelve saldo en USD y su equivalente en bolívares (debt_bs) con la tasa BCV del día ya calculada. Úsala cuando el usuario envíe su cédula. Si el chat empezó con un comprobante, pide la cédula primero y luego usa esta tool.",
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
    name: GET_BCV_RATE_TOOL,
    description:
      "Consulta la tasa BCV/dólar del día (dolarvzla). Úsala solo si el cliente pregunta por la tasa y NO necesitas consultar saldo. Para saldo pendiente usa lookup_wispro_by_cedula (ya trae debt_bs).",
    parameters: {
      type: "object",
      properties: {},
      required: [],
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
1) lookup_wispro_by_cedula — cédula del abonado. Trae debt_usd, debt_bs, bcv_rate ya calculados.
2) get_bcv_rate — solo si preguntan la tasa BCV del día sin consultar saldo (fuente rates.dolarvzla.com/bcv).
3) link_wispro_client — opcional; no bloquea pagos.
4) submit_payment_receipt — registrar comprobante (requiere lookup previo). Tras éxito/error: etiqueta "Verificar pago" + handoff.
5) escalate_to_human — category=support al cerrar diagnóstico; category=general si pide humano. NO al solo recibir comprobante.

Tasa BCV / bolívares (CRÍTICO):
- NUNCA inventes ni recalcules la tasa.
- Para saldo: usa debt_bs_formatted / debt_usd_formatted del lookup.
- Si bcv_error aparece, informa solo USD y di que no se pudo obtener la tasa del día.
- Formato bolívares: miles con punto y decimales con coma (ej. Bs. 20.381,75).

Flujo obligatorio de pagos:
1) Si llega imagen de comprobante SIN cédula: analiza y PIDE la cédula. No hagas handoff.
2) Con cédula: lookup_wispro_by_cedula.
3) Luego submit_payment_receipt.
4) Confirma según el resultado de la tool. Nunca digas que el pago está aprobado.

Flujo obligatorio de soporte técnico:
1) Identifica y haz preguntas de diagnóstico breves.
2) Resume el caso en message de escalate_to_human con category=support.
3) No des pasos de reparación.

Reglas:
- No inventes monto, referencia ni banco.
- Si hay varios matches Wispro, confirma cuál es antes del submit.
- Responde siempre en texto claro por WhatsApp (sin JSON).`;
