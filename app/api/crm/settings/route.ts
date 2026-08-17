import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { createClient } from "@supabase/supabase-js";
import { AI_SYSTEM_PROMPT_MAX_LENGTH } from "@/app/crm/_lib/ai-default-prompt";
import { getCrmSettings, updateCrmSettings } from "../_lib/crm-settings";
import {
  DEFAULT_AFTER_HOURS_PAYMENT_TOOLS,
  parseAfterHoursPaymentsConfig,
  parseOfficeHoursConfig,
} from "../_lib/office-hours";

const timeWindowSchema = z.tuple([
  z.string().regex(/^\d{1,2}:\d{2}$/, "Hora inválida"),
  z.string().regex(/^\d{1,2}:\d{2}$/, "Hora inválida"),
]);

const weekdayWindowsSchema = z.array(timeWindowSchema);

const officeHoursSchema = z.object({
  enabled: z.boolean(),
  timezone: z.string().trim().min(1).max(80),
  days: z.object({
    mon: weekdayWindowsSchema,
    tue: weekdayWindowsSchema,
    wed: weekdayWindowsSchema,
    thu: weekdayWindowsSchema,
    fri: weekdayWindowsSchema,
    sat: weekdayWindowsSchema,
    sun: weekdayWindowsSchema,
  }),
  holidays: z.array(z.string().regex(/^\d{4}-\d{2}-\d{2}$/)).optional(),
});

const afterHoursPaymentsSchema = z.object({
  enabled: z.boolean(),
  allowedTools: z.array(z.string().trim().min(1)).min(1).optional(),
});

const updateSchema = z
  .object({
    agent_id: z.coerce.number().int().positive("agent_id es requerido"),
    gemini_model: z.string().trim().min(1).max(120).optional(),
    ai_system_prompt: z
      .string()
      .max(
        AI_SYSTEM_PROMPT_MAX_LENGTH,
        `El prompt no puede superar ${AI_SYSTEM_PROMPT_MAX_LENGTH} caracteres`,
      )
      .nullable()
      .optional(),
    office_hours: officeHoursSchema.optional(),
    after_hours_payments: afterHoursPaymentsSchema.optional(),
  })
  .refine(
    (value) =>
      value.gemini_model !== undefined ||
      value.ai_system_prompt !== undefined ||
      value.office_hours !== undefined ||
      value.after_hours_payments !== undefined,
    { message: "Debes enviar al menos un campo para actualizar" },
  );

const getAnonClient = () => {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const anonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;
  if (!url || !anonKey) {
    throw new Error("Supabase no configurado");
  }
  return createClient(url, anonKey);
};

const assertAdminAgent = async (
  supabase: ReturnType<typeof getAnonClient>,
  agentId: number,
) => {
  const { data: agent, error: agentError } = await supabase
    .from("agents")
    .select("id, role")
    .eq("id", agentId)
    .maybeSingle();

  if (agentError) {
    return {
      error: NextResponse.json(
        { error: "No se pudo validar el agente" },
        { status: 500 },
      ),
    } as const;
  }

  if (!agent) {
    return {
      error: NextResponse.json({ error: "Agente no encontrado" }, { status: 404 }),
    } as const;
  }

  const role = String(agent.role || "").toLowerCase();
  if (role !== "admin" && role !== "administrador") {
    return {
      error: NextResponse.json(
        { error: "Solo un administrador puede cambiar los ajustes" },
        { status: 403 },
      ),
    } as const;
  }

  return { agent } as const;
};

export async function GET() {
  try {
    const supabase = getAnonClient();
    const settings = await getCrmSettings(supabase);
    return NextResponse.json({ settings });
  } catch (error) {
    console.error("[CRM_SETTINGS] get_failed", error);
    return NextResponse.json(
      { error: "No se pudieron cargar los ajustes" },
      { status: 500 },
    );
  }
}

export async function PATCH(req: NextRequest) {
  try {
    const payload = updateSchema.safeParse(await req.json());
    if (!payload.success) {
      return NextResponse.json(
        { error: payload.error.issues[0]?.message || "Datos inválidos" },
        { status: 400 },
      );
    }

    const supabase = getAnonClient();
    const adminCheck = await assertAdminAgent(supabase, payload.data.agent_id);
    if ("error" in adminCheck) {
      return adminCheck.error;
    }

    const officeHours = payload.data.office_hours
      ? parseOfficeHoursConfig(payload.data.office_hours)
      : undefined;

    const afterHoursPayments = payload.data.after_hours_payments
      ? parseAfterHoursPaymentsConfig({
          enabled: payload.data.after_hours_payments.enabled,
          allowedTools:
            payload.data.after_hours_payments.allowedTools ||
            [...DEFAULT_AFTER_HOURS_PAYMENT_TOOLS],
        })
      : undefined;

    const settings = await updateCrmSettings(supabase, {
      gemini_model: payload.data.gemini_model,
      ai_system_prompt:
        typeof payload.data.ai_system_prompt === "string"
          ? payload.data.ai_system_prompt.trim() || null
          : payload.data.ai_system_prompt,
      office_hours: officeHours,
      after_hours_payments: afterHoursPayments,
      updated_by: payload.data.agent_id,
    });

    return NextResponse.json({ settings });
  } catch (error) {
    console.error("[CRM_SETTINGS] update_failed", error);
    return NextResponse.json(
      {
        error:
          error instanceof Error
            ? error.message
            : "No se pudieron guardar los ajustes",
      },
      { status: 500 },
    );
  }
}
