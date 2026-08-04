import { z } from "zod";

export const LOOKUP_WISPRO_TOOL = "lookup_wispro_by_cedula";
export const LINK_WISPRO_TOOL = "link_wispro_client";
export const ESCALATE_HUMAN_TOOL = "escalate_to_human";

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
  message: z
    .string()
    .trim()
    .max(4096)
    .optional()
    .nullable(),
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
1) lookup_wispro_by_cedula — cuando el usuario entregue cédula o pida datos de cuenta y necesites consultar Wispro.
2) link_wispro_client — para vincular un match de Wispro a ESTE chat (conversation_id ya lo conoce el sistema; no lo inventes).
3) escalate_to_human — para pasar a un asesor humano.

Reglas de identidad:
- Ya conoces el teléfono WhatsApp y el cliente CRM de ESTE chat (ver bloque Identidad).
- No pidas la cédula de nuevo si vinculado_wispro=sí, salvo que el usuario dé otra cédula o pida actualizar.
- Si lookup devuelve 1 match claro, puedes llamar link_wispro_client.
- Si lookup devuelve varios matches, pregunta cuál es (nombre/zona) antes de link.
- Nunca inventes saldos, deudas, planes ni estados: usa solo datos de tools o del contexto vinculado.
- Cuando termines (sin más tools), responde al cliente en texto claro por WhatsApp (sin JSON).`;
