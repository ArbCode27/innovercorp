import { NextRequest, NextResponse } from "next/server";

const VERIFY_TOKEN = process.env.WHATSAPP_VERIFY_TOKEN!;
const MAKE_WEBHOOK_URL = process.env.MAKE_WEBHOOK_URL!;

export async function GET(req: NextRequest) {
  const { searchParams } = new URL(req.url);

  const mode = searchParams.get("hub.mode");
  const token = searchParams.get("hub.verify_token");
  const challenge = searchParams.get("hub.challenge");

  if (mode === "subscribe" && token === VERIFY_TOKEN) {
    console.log("✅ Webhook verificado por Meta");
    return new NextResponse(challenge, { status: 200 });
  }

  return new NextResponse("Forbidden", { status: 403 });
}

export async function POST(req: NextRequest) {
  try {
    // ✅ Leer como texto crudo para no alterar el payload
    const rawBody = await req.text();

    console.log("📨 Body recibido de Meta:", rawBody);

    if (!MAKE_WEBHOOK_URL) {
      console.error("❌ MAKE_WEBHOOK_URL no está definida");
      return new NextResponse("Config error", { status: 500 });
    }

    const makeResponse = await fetch(MAKE_WEBHOOK_URL, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Accept: "application/json",
      },
      body: rawBody, // ✅ reenviar sin tocar
    });

    console.log("✅ Make respondió con status:", makeResponse.status);

    // Meta siempre espera un 200 rápido
    return new NextResponse("OK", { status: 200 });
  } catch (error) {
    console.error("❌ Error en webhook:", error);
    return new NextResponse("Error", { status: 500 });
  }
}
