import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { parseWisproSearchResults } from "@/app/crm/_lib/wispro-webhook";

const searchSchema = z.object({
  cedula: z
    .string()
    .trim()
    .min(5, "La cédula debe tener al menos 5 dígitos")
    .max(12, "La cédula no puede superar 12 dígitos")
    .regex(/^\d+$/, "La cédula solo puede contener números"),
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
    const payload = searchSchema.safeParse(await req.json());

    if (!payload.success) {
      return NextResponse.json(
        { error: payload.error.issues[0]?.message || "Datos inválidos" },
        { status: 400 },
      );
    }

    const { cedula } = payload.data;
    const proxyUrl = getServerEnv("WISPRO_PROXY_URL");

    const proxyResponse = await fetch(proxyUrl, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ cedula }),
    });

    if (!proxyResponse.ok) {
      console.error("Wispro proxy error:", proxyResponse.status);
      return NextResponse.json(
        { error: "No se pudo consultar Wispro. Intenta de nuevo." },
        { status: 502 },
      );
    }

    const rawBody = await proxyResponse.text();
    console.log("[Wispro webhook] respuesta literal del webhook:", rawBody);

    let proxyData: unknown;
    try {
      proxyData = JSON.parse(rawBody);
    } catch {
      console.error("[Wispro webhook] la respuesta no es JSON válido");
      return NextResponse.json(
        { error: "La respuesta de Wispro no es válida" },
        { status: 502 },
      );
    }

    const results = parseWisproSearchResults(proxyData, {
      fallbackCedula: cedula,
    });

    console.log(
      "[Wispro webhook] resultados normalizados:",
      results.length,
      results,
    );

    return NextResponse.json({
      data: results,
      webhookRaw: rawBody,
      webhookParsed: proxyData,
    });
  } catch (error) {
    if (error instanceof Error && error.message.startsWith("Missing environment")) {
      console.error(error.message);
      return NextResponse.json(
        { error: "Integración Wispro no configurada en el servidor" },
        { status: 503 },
      );
    }

    console.error("Wispro search error:", error);
    return NextResponse.json(
      { error: "Error interno al consultar Wispro" },
      { status: 500 },
    );
  }
}
