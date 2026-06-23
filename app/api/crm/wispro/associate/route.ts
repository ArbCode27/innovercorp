import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";
import { z } from "zod";
import { associateWisproClient } from "@/app/crm/_lib/wispro-associate";
import type { Client } from "@/app/crm/_lib/types";

const wisproCustomerSchema = z.object({
  id: z.string().min(1),
  name: z.string().min(1),
  national_identification_number: z.string().min(1),
  phone_mobile: z.string().nullable().optional(),
  zone_name: z.string().nullable().optional(),
  city: z.string().nullable().optional(),
  state: z.string().nullable().optional(),
});

const wisproInvoicingSchema = z.object({
  debt: z.number(),
  hasDebt: z.boolean(),
  accountStatus: z.enum(["Al día", "Con deuda", "Suspendido", "Prospecto"]),
  snapshot: z
    .object({
      invoiceIndex: z.number(),
      itemIndex: z.number(),
      gross_amount: z.number(),
      amount: z.number(),
    })
    .nullable(),
});

const associateSchema = z.object({
  conversationId: z.coerce.number().int().positive(),
  customer: wisproCustomerSchema,
  invoicing: wisproInvoicingSchema,
  existingClientId: z.coerce.number().int().positive().nullable().optional(),
  conversationPhone: z.string().nullable().optional(),
  whatsappId: z.string().nullable().optional(),
  waName: z.string().nullable().optional(),
});

const getServerEnv = (key: string) => {
  const value = process.env[key];

  if (!value) {
    throw new Error(`Missing environment variable: ${key}`);
  }

  return value;
};

export async function POST(req: NextRequest) {
  try {
    const payload = associateSchema.safeParse(await req.json());

    if (!payload.success) {
      return NextResponse.json(
        { error: payload.error.issues[0]?.message || "Datos inválidos" },
        { status: 400 },
      );
    }

    const {
      conversationId,
      customer,
      invoicing,
      existingClientId,
      conversationPhone,
      whatsappId,
      waName,
    } = payload.data;

    const supabase = createClient(
      getServerEnv("NEXT_PUBLIC_SUPABASE_URL"),
      getServerEnv("SUPABASE_SERVICE_ROLE_KEY"),
    );

    const { data: conversation, error: conversationError } = await supabase
      .from("conversations")
      .select("id, client_id")
      .eq("id", conversationId)
      .maybeSingle<{ id: number; client_id: number | null }>();

    if (conversationError) {
      console.error("Wispro associate conversation lookup:", conversationError);
      return NextResponse.json(
        { error: "No se pudo validar la conversación" },
        { status: 500 },
      );
    }

    if (!conversation) {
      return NextResponse.json(
        { error: "La conversación no existe" },
        { status: 404 },
      );
    }

    const client = await associateWisproClient(supabase, {
      conversationId,
      customer,
      invoicing,
      existingClientId: existingClientId ?? conversation.client_id,
      conversationPhone,
      whatsappId,
      waName,
    });

    return NextResponse.json({ client: client as Client });
  } catch (error) {
    if (error instanceof Error && error.message.startsWith("Missing environment")) {
      console.error(error.message);
      return NextResponse.json(
        { error: "Integración Wispro no configurada en el servidor" },
        { status: 503 },
      );
    }

    const message =
      error instanceof Error ? error.message : "No se pudo asociar el cliente";

    console.error("Wispro associate error:", error);

    return NextResponse.json({ error: message }, { status: 500 });
  }
}
