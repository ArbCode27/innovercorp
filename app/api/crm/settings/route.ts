import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { createClient } from "@supabase/supabase-js";
import { isBotEngine } from "../_lib/bot-engine";
import { getCrmSettings, updateCrmSettings } from "../_lib/crm-settings";

const updateSchema = z.object({
  bot_engine: z.enum(["gemini", "make"]),
  gemini_model: z.string().trim().min(1).max(120).optional(),
  ai_system_prompt: z.string().max(8000).nullable().optional(),
  agent_id: z.coerce.number().int().positive().optional(),
});

const getAnonClient = () => {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const anonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;
  if (!url || !anonKey) {
    throw new Error("Supabase no configurado");
  }
  return createClient(url, anonKey);
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

    if (!isBotEngine(payload.data.bot_engine)) {
      return NextResponse.json(
        { error: "Motor de bot inválido" },
        { status: 400 },
      );
    }

    const supabase = getAnonClient();

    if (payload.data.agent_id) {
      const { data: agent, error: agentError } = await supabase
        .from("agents")
        .select("id, role")
        .eq("id", payload.data.agent_id)
        .maybeSingle();

      if (agentError) {
        return NextResponse.json(
          { error: "No se pudo validar el agente" },
          { status: 500 },
        );
      }

      if (!agent) {
        return NextResponse.json({ error: "Agente no encontrado" }, { status: 404 });
      }

      const role = String(agent.role || "").toLowerCase();
      if (role !== "admin" && role !== "administrador") {
        return NextResponse.json(
          { error: "Solo un administrador puede cambiar el motor global" },
          { status: 403 },
        );
      }
    }

    const settings = await updateCrmSettings(supabase, {
      bot_engine: payload.data.bot_engine,
      gemini_model: payload.data.gemini_model,
      ai_system_prompt: payload.data.ai_system_prompt,
      updated_by: payload.data.agent_id ?? null,
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
