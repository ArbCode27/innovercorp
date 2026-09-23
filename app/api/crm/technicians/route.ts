import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { createClient, type SupabaseClient } from "@supabase/supabase-js";
import {
  deleteTechnician,
  listAllTechnicians,
  normalizeTechnicianPhoneLast10,
  toggleTechnicianStatus,
  upsertTechnician,
} from "@/lib/crm-technicians";
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
        { error: "Acceso denegado: solo un administrador puede gestionar técnicos" },
        { status: 403 },
      ),
    } as const;
  }

  return { agent } as const;
};

const createTechnicianSchema = z.object({
  agent_id: z.coerce.number().int().positive("agent_id es requerido"),
  name: z.string().trim().min(1, "El nombre es requerido"),
  whatsapp_phone: z
    .string()
    .trim()
    .min(10, "El WhatsApp debe tener al menos 10 dígitos"),
  document: z.string().trim().nullable().optional(),
  notes: z.string().trim().nullable().optional(),
  active: z.boolean().optional(),
});

const updateTechnicianSchema = z.object({
  agent_id: z.coerce.number().int().positive("agent_id es requerido"),
  id: z.string().uuid("id de técnico inválido"),
  name: z.string().trim().min(1, "El nombre es requerido").optional(),
  whatsapp_phone: z
    .string()
    .trim()
    .min(10, "El WhatsApp debe tener al menos 10 dígitos")
    .optional(),
  document: z.string().trim().nullable().optional(),
  notes: z.string().trim().nullable().optional(),
  active: z.boolean().optional(),
});

const deleteTechnicianSchema = z.object({
  agent_id: z.coerce.number().int().positive("agent_id es requerido"),
  id: z.string().uuid("id de técnico inválido"),
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

    const technicians = await listAllTechnicians(supabase);
    return NextResponse.json({ ok: true, technicians });
  } catch (error) {
    console.error("[CRM_TECHNICIANS] get_failed", error);
    return NextResponse.json(
      { error: error instanceof Error ? error.message : "Error al cargar técnicos" },
      { status: 500 },
    );
  }
};

export const POST = async (request: NextRequest) => {
  try {
    const json = await request.json().catch(() => null);
    const parsed = createTechnicianSchema.safeParse(json);

    if (!parsed.success) {
      return NextResponse.json(
        { error: parsed.error.issues[0]?.message || "Datos inválidos" },
        { status: 400 },
      );
    }

    const { agent_id, name, whatsapp_phone, document, notes, active } =
      parsed.data;
    const phoneLast10 = normalizeTechnicianPhoneLast10(whatsapp_phone);
    if (!phoneLast10) {
      return NextResponse.json(
        { error: "El WhatsApp debe contener al menos 10 dígitos válidos" },
        { status: 400 },
      );
    }

    const supabase = getClient();
    const authResult = await assertAdminAgent(supabase, agent_id);
    if ("error" in authResult) return authResult.error;

    const technician = await upsertTechnician(
      supabase,
      {
        name,
        whatsappPhone: whatsapp_phone,
        document,
        notes,
        active: active !== false,
      },
      agent_id,
    );

    return NextResponse.json({ ok: true, technician }, { status: 201 });
  } catch (error) {
    const message =
      error instanceof Error ? error.message : "Error al crear técnico";
    const status = message.includes("Ya existe") ? 409 : 500;
    return NextResponse.json({ error: message }, { status });
  }
};

export const PATCH = async (request: NextRequest) => {
  try {
    const json = await request.json().catch(() => null);
    const parsed = updateTechnicianSchema.safeParse(json);

    if (!parsed.success) {
      return NextResponse.json(
        { error: parsed.error.issues[0]?.message || "Datos inválidos" },
        { status: 400 },
      );
    }

    const { agent_id, id, name, whatsapp_phone, document, notes, active } =
      parsed.data;

    const supabase = getClient();
    const authResult = await assertAdminAgent(supabase, agent_id);
    if ("error" in authResult) return authResult.error;

    // Check if only toggling active status
    if (
      active !== undefined &&
      name === undefined &&
      whatsapp_phone === undefined &&
      document === undefined &&
      notes === undefined
    ) {
      const technician = await toggleTechnicianStatus(supabase, id);
      return NextResponse.json({ ok: true, technician });
    }

    if (whatsapp_phone) {
      const phoneLast10 = normalizeTechnicianPhoneLast10(whatsapp_phone);
      if (!phoneLast10) {
        return NextResponse.json(
          { error: "El WhatsApp debe contener al menos 10 dígitos válidos" },
          { status: 400 },
        );
      }
    }

    const { data: current } = await supabase
      .from("crm_technicians")
      .select("*")
      .eq("id", id)
      .maybeSingle();

    if (!current) {
      return NextResponse.json(
        { error: "Técnico no encontrado" },
        { status: 404 },
      );
    }

    const technician = await upsertTechnician(
      supabase,
      {
        id,
        name: name ?? current.name,
        whatsappPhone:
          whatsapp_phone ??
          current.whatsapp_phone_last10 ??
          current.phone_last10 ??
          "",
        document: document !== undefined ? document : current.document,
        notes: notes !== undefined ? notes : current.notes,
        active: active !== undefined ? active : current.active,
      },
      agent_id,
    );

    return NextResponse.json({ ok: true, technician });
  } catch (error) {
    const message =
      error instanceof Error ? error.message : "Error al actualizar técnico";
    const status = message.includes("Ya existe") ? 409 : 500;
    return NextResponse.json({ error: message }, { status });
  }
};

export const DELETE = async (request: NextRequest) => {
  try {
    const json = await request.json().catch(() => null);
    const parsed = deleteTechnicianSchema.safeParse(json);

    if (!parsed.success) {
      return NextResponse.json(
        { error: parsed.error.issues[0]?.message || "Datos inválidos" },
        { status: 400 },
      );
    }

    const { agent_id, id } = parsed.data;
    const supabase = getClient();
    const authResult = await assertAdminAgent(supabase, agent_id);
    if ("error" in authResult) return authResult.error;

    await deleteTechnician(supabase, id);
    return NextResponse.json({ ok: true });
  } catch (error) {
    return NextResponse.json(
      { error: error instanceof Error ? error.message : "Error al eliminar técnico" },
      { status: 500 },
    );
  }
};
