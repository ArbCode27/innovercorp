import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import {
  searchWisproByCedula,
  WisproApiError,
} from "@/app/api/crm/_lib/wispro-api";

const LOG_PREFIX = "[WISPRO_SEARCH]";

const searchSchema = z.object({
  cedula: z
    .string()
    .trim()
    .min(5, "La cédula debe tener al menos 5 dígitos")
    .max(12, "La cédula no puede superar 12 dígitos")
    .regex(/^\d+$/, "La cédula solo puede contener números"),
});

export async function POST(req: NextRequest) {
  try {
    const payload = searchSchema.safeParse(await req.json());

    if (!payload.success) {
      return NextResponse.json(
        { error: payload.error.issues[0]?.message || "Datos inválidos" },
        { status: 400 },
      );
    }

    const results = await searchWisproByCedula(payload.data.cedula);

    return NextResponse.json({ data: results });
  } catch (error) {
    if (error instanceof WisproApiError) {
      console.error(`${LOG_PREFIX} wispro_error`, {
        code: error.code,
        message: error.message,
      });
      return NextResponse.json(
        { error: error.message },
        { status: error.status },
      );
    }

    console.error(`${LOG_PREFIX} unexpected_error`, error);
    return NextResponse.json(
      { error: "Error interno al consultar Wispro" },
      { status: 500 },
    );
  }
}
