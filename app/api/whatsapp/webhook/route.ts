import { NextRequest, NextResponse } from "next/server";

const VERIFY_TOKEN = process.env.WHATSAPP_VERIFY_TOKEN!; // "micrm2024"
const MAKE_WEBHOOK_URL = process.env.MAKE_WEBHOOK_URL!; // URL de Make

// Meta verifica el webhook con GET
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

// Meta envía eventos con POST → los reenviamos a Make
export async function POST(req: NextRequest) {
  const body = await req.json();

  // Reenviar a Make
  await fetch(MAKE_WEBHOOK_URL, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(body),
  });

  // Meta siempre espera un 200 rápido
  return new NextResponse("OK", { status: 200 });
}
