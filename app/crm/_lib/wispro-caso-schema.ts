import { z } from "zod";

export const ORDER_KINDS = [
  "technical",
  "installation",
  "resignation",
  "feasibility",
] as const;

export const TICKET_PRIORITIES = [
  "low",
  "medium",
  "high",
  "urgent",
] as const;

export const ticketPriorityLabels: Record<(typeof TICKET_PRIORITIES)[number], string> = {
  low: "Baja",
  medium: "Media",
  high: "Alta",
  urgent: "Urgente",
};

export const orderKindLabels: Record<(typeof ORDER_KINDS)[number], string> = {
  technical: "Visita técnica por falla",
  installation: "Instalación nueva",
  resignation: "Baja de servicio",
  feasibility: "Estudio de factibilidad",
};

const emptyToNull = z
  .union([z.string(), z.null(), z.undefined()])
  .transform((value) => {
    const next = String(value || "").trim();
    return next || null;
  });

const optionalUuid = emptyToNull.refine(
  (value) => value === null || z.string().uuid().safeParse(value).success,
  "UUID inválido",
);

const optionalStringId = emptyToNull;

export const gpsSchema = z
  .object({
    street: z.string().trim().optional().nullable(),
    number: z.string().trim().optional().nullable(),
    city: z.string().trim().optional().nullable(),
    state: z.string().trim().optional().nullable(),
    countryCode: z.string().trim().optional().nullable(),
    latitude: z.coerce.number(),
    longitude: z.coerce.number(),
  })
  .nullable()
  .optional();

const optionalPositiveInt = z.preprocess(
  (value) => {
    if (value === "" || value === null || value === undefined) return null;
    const parsed = Number(value);
    return Number.isFinite(parsed) ? parsed : value;
  },
  z.number().int().positive().nullable().optional(),
);

const crmFichaFields = {
  conversationId: optionalPositiveInt,
  crmClientId: optionalPositiveInt,
  clientName: emptyToNull,
  clientPhone: emptyToNull,
  cause: emptyToNull,
  mapsUrl: emptyToNull,
  addressText: emptyToNull,
  facadeMediaUrl: emptyToNull,
  facadeMessageId: optionalPositiveInt,
};

export const createCasoSchema = z.object({
  title: z.string().trim().min(1, "El título es obligatorio").max(80),
  description: z.string().trim().min(1, "La descripción es obligatoria"),
  priority: z.enum(TICKET_PRIORITIES).default("medium"),
  categoryId: z.string().trim().min(1, "Categoría requerida"),
  clientId: optionalStringId,
  contractId: optionalStringId,
  assignableId: optionalStringId,
  generateOrder: z.boolean().default(true),
  kind: z.enum(ORDER_KINDS).default("technical"),
  orderDescription: z.string().trim().optional().nullable(),
  startAt: z.string().trim().optional().nullable(),
  endAt: z.string().trim().optional().nullable(),
  employeeId: optionalStringId,
  gps: gpsSchema,
  ...crmFichaFields,
});

export const editCasoSchema = z.object({
  issueId: z.string().trim().min(1, "Ticket inválido"),
  title: z.string().trim().min(1, "El título es obligatorio").max(100),
  cause: z.string().trim().optional().nullable(),
  description: z.string().trim().optional().nullable(),
  priority: z.enum(TICKET_PRIORITIES),
  employeeId: optionalStringId,
  addressText: z.string().trim().optional().nullable(),
  mapsUrl: z.string().trim().optional().nullable(),
  windowStart: z.string().trim().optional().nullable(),
  windowEnd: z.string().trim().optional().nullable(),
  status: z.enum(["open", "scheduled", "done", "cancelled"]).optional(),
});

export type EditCasoInput = z.infer<typeof editCasoSchema>;

export const retryCasoSchema = z.object({
  ticketId: z.string().trim().min(1, "Ticket inválido"),
  publicId: z.number().int().optional().nullable(),
  generateOrder: z.boolean().default(true),
  existingOrderId: optionalStringId,
  kind: z.enum(ORDER_KINDS).default("technical"),
  orderDescription: z.string().trim().optional().nullable(),
  startAt: z.string().trim().optional().nullable(),
  endAt: z.string().trim().optional().nullable(),
  contractId: optionalStringId,
  employeeId: optionalStringId,
  gps: gpsSchema,
  ...crmFichaFields,
});

export type CreateCasoInput = z.infer<typeof createCasoSchema>;
export type RetryCasoInput = z.infer<typeof retryCasoSchema>;

export const CLIENT_STATUS_OPTIONS = [
  { value: "Operativo y conforme", label: "🟢 Operativo y conforme" },
  { value: "Operativo con observación", label: "🟡 Operativo con observación" },
  { value: "No resuelto / Requiere nueva visita", label: "🔴 No resuelto / Requiere nueva visita" },
  { value: "Cliente ausente", label: "⚪ Cliente ausente" },
] as const;

export const finalizeCasoFormSchema = z.object({
  issueId: z.string().uuid("Ticket inválido"),
  resolutionObservation: z
    .string()
    .trim()
    .min(3, "La observación o diagnóstico es requerida"),
  resolutionSolution: z
    .string()
    .trim()
    .min(3, "La descripción de la solución es requerida"),
  clientStatus: z
    .string()
    .trim()
    .min(2, "El estado del cliente es requerido"),
});

export type FinalizeCasoFormInput = z.infer<typeof finalizeCasoFormSchema>;

export const manageCasoSchema = z.discriminatedUnion("action", [
  finalizeCasoFormSchema.extend({
    action: z.literal("finalize"),
  }),
  z.object({
    action: z.literal("reassign"),
    issueId: z.string().uuid("Ticket inválido"),
    employeeId: z.string().uuid("Técnico inválido"),
  }),
  editCasoSchema.extend({
    action: z.literal("edit"),
  }),
  z.object({
    action: z.literal("delete"),
    issueId: z.string().uuid("Ticket inválido"),
  }),
]);

export type ManageCasoInput = z.infer<typeof manageCasoSchema>;
