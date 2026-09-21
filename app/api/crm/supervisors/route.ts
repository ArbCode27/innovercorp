import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { createClient, type SupabaseClient } from "@supabase/supabase-js";
import {
  listAllSupervisors,
  normalizeSupervisorPhoneLast10,
  toggleSupervisorStatus,
  upsertSupervisor,
} from "@/lib/crm-supervisors";
import { getSupabaseAdmin } from "../_lib/supabase-admin";

const getClient = (): SupabaseClient => {
  try {
    return getSupabaseAdmin();
  } catch {
    const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
    const anonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;
    if (!url || !anonKey) {
      throw new Error("Supabase credentials not configured");
    }
    return createClient(url, anonKey);
  }
};

const assertAdminAgent = async (
  supabase: SupabaseClient,
  agentId: number,
) => {
  const { data: agent, error } = await supabase
    .from("agents")
    .select("id, role, name")
    .eq("id", agentId)
    .maybeSingle();

  if (error) {
    return {
      error: NextResponse.json(
        { error: "No se pudo validar el agente" },
        { status: 500 },
      ),
    } as const;
  }

  if (!agent) {
    return {
      error: NextResponse.json(
        { error: "Agente no encontrado" },
        { status: 404 },
      ),
    } as const;
  }

  const role = String(agent.role || "").toLowerCase();
  if (role !== "admin" && role !== "administrador") {
    return {
      error: NextResponse.json(
        { error: "Acceso denegado: solo un administrador puede gestionar gerentes" },
        { status: 403 },
      ),
    } as const;
  }

  return { agent } as const;
};

const createSupervisorSchema = z.object({
  agent_id: z.coerce.number().int().positive("agent_id es requerido"),
  name: z.string().trim().min(1, "El nombre es requerido"),
  phone: z.string().trim().min(10, "El teléfono debe tener al menos 10 dígitos"),
  wispro_employee_id: z.string().trim().nullable().optional(),
  active: z.boolean().optional(),
});

const updateSupervisorSchema = z.object({
  agent_id: z.coerce.number().int().positive("agent_id es requerido"),
  id: z.string().uuid("id de gerente inválido"),
  name: z.string().trim().min(1, "El nombre es requerido").optional(),
  phone: z.string().trim().min(10, "El teléfono debe tener al menos 10 dígitos").optional(),
  wispro_employee_id: z.string().trim().nullable().optional(),
  active: z.boolean().optional(),
});

export const GET = async (request: NextRequest) => {
  try {
    const { searchParams } = new URL(request.url);
    const agentIdParam =
      searchParams.get("agent_id") || request.headers.get("x-agent-id");

    const agentId = Number(agentIdParam);
    if (!agentId || Number.isNaN(agentId) || agentId <= 0) {
      return NextResponse.json(
        { error: "agent_id es requerido para autorizar la solicitud" },
        { status: 401 },
      );
    }

    const supabase = getClient();
    const authResult = await assertAdminAgent(supabase, agentId);
    if ("error" in authResult) return authResult.error;

    const supervisors = await listAllSupervisors(supabase);
    return NextResponse.json({ ok: true, supervisors });
  } catch (error) {
    console.error("[CRM_SUPERVISORS] get_failed", error);
    return NextResponse.json(
      { error: error instanceof Error ? error.message : "Error al cargar gerentes" },
      { status: 500 },
    );
  }
};

export const POST = async (request: NextRequest) => {
  try {
    const json = await request.json().catch(() => null);
    const parsed = createSupervisorSchema.safeParse(json);

    if (!parsed.success) {
      return NextResponse.json(
        { error: parsed.error.issues[0]?.message || "Datos inválidos" },
        { status: 400 },
      );
    }

    const { agent_id, name, phone, wispro_employee_id, active } = parsed.data;
    const phoneLast10 = normalizeSupervisorPhoneLast10(phone);
    if (!phoneLast10) {
      return NextResponse.json(
        { error: "El teléfono debe contener al menos 10 dígitos válidos" },
        { status: 400 },
      );
    }

    const supabase = getClient();
    const authResult = await assertAdminAgent(supabase, agent_id);
    if ("error" in authResult) return authResult.error;

    const supervisor = await upsertSupervisor(
      supabase,
      {
        name,
        phone,
        wisproEmployeeId: wispro_employee_id,
        active: active !== false,
      },
      agent_id,
    );

    return NextResponse.json({ ok: true, supervisor }, { status: 201 });
  } catch (error) {
    const message =
      error instanceof Error ? error.message : "Error al crear gerente";
    const status = message.includes("Ya existe") ? 409 : 500;
    return NextResponse.json({ error: message }, { status });
  }
};

export const PATCH = async (request: NextRequest) => {
  try {
    const json = await request.json().catch(() => null);
    const parsed = updateSupervisorSchema.safeParse(json);

    if (!parsed.success) {
      return NextResponse.json(
        { error: parsed.error.issues[0]?.message || "Datos inválidos" },
        { status: 400 },
      );
    }

    const { agent_id, id, name, phone, wispro_employee_id, active } =
      parsed.data;

    const supabase = getClient();
    const authResult = await assertAdminAgent(supabase, agent_id);
    if ("error" in authResult) return authResult.error;

    // Check if only toggling active status
    if (active !== undefined && name === undefined && phone === undefined && wispro_employee_id === undefined) {
      const supervisor = await toggleSupervisorStatus(supabase, id, active);
      return NextResponse.json({ ok: true, supervisor });
    }

    if (phone) {
      const phoneLast10 = normalizeSupervisorPhoneLast10(phone);
      if (!phoneLast10) {
        return NextResponse.json(
          { error: "El teléfono debe contener al menos 10 dígitos válidos" },
          { status: 400 },
        );
      }
    }

    // Get current record to fill missing fields if needed
    const { data: current } = await supabase
      .from("crm_supervisors")
      .select("*")
      .eq("id", id)
      .maybeSingle();

    if (!current) {
      return NextResponse.json(
        { error: "Gerente no encontrado" },
        { status: 404 },
      );
    }

    const supervisor = await upsertSupervisor(
      supabase,
      {
        id,
        name: name ?? current.name,
        phone: phone ?? current.phone_last10,
        wisproEmployeeId:
          wispro_employee_id !== undefined
            ? wispro_employee_id
            : current.wispro_employee_id,
        active: active !== undefined ? active : current.active,
      },
      agent_id,
    );

    return NextResponse.json({ ok: true, supervisor });
  } catch (error) {
    const message =
      error instanceof Error ? error.message : "Error al actualizar gerente";
    const status = message.includes("Ya existe") ? 409 : 500;
    return NextResponse.json({ error: message }, { status });
  }
};
