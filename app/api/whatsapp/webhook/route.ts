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
    const rawBody = await req.json();

    // Extraer el valor principal
    const entry = rawBody?.entry?.[0];
    const changes = entry?.changes?.[0];
    const value = changes?.value;

    if (!value) {
      console.log("⚠️ Payload sin value, ignorando");
      return new NextResponse("OK", { status: 200 });
    }

    // ── CASO 1: Mensaje entrante ──────────────────────────
    if (value.messages && value.messages.length > 0) {
      const message = value.messages[0];
      const contact = value.contacts?.[0];
      const metadata = value.metadata;

      // Extraer contenido según tipo de mensaje
      let content = null;
      let media_id = null;
      let caption = null;
      let mime_type = null;
      let latitude = null;
      let longitude = null;
      let location_name = null;
      let location_address = null;

      switch (message.type) {
        case "text":
          content = message.text?.body;
          break;
        case "image":
          media_id = message.image?.id;
          caption = message.image?.caption;
          mime_type = message.image?.mime_type;
          break;
        case "audio":
          media_id = message.audio?.id;
          mime_type = message.audio?.mime_type;
          break;
        case "video":
          media_id = message.video?.id;
          caption = message.video?.caption;
          mime_type = message.video?.mime_type;
          break;
        case "document":
          media_id = message.document?.id;
          caption = message.document?.caption;
          mime_type = message.document?.mime_type;
          break;
        case "location":
          latitude = message.location?.latitude ?? null;
          longitude = message.location?.longitude ?? null;
          location_name = message.location?.name || null;
          location_address = message.location?.address || null;
          content =
            location_name ||
            location_address ||
            (latitude !== null && longitude !== null
              ? `${latitude},${longitude}`
              : null);
          break;
        default:
          break;
      }

      const parsedTimestamp = Number(message.timestamp);
      const timestamp = Number.isFinite(parsedTimestamp)
        ? new Date(parsedTimestamp * 1000).toISOString()
        : new Date().toISOString();

      // Payload limpio para Make
      const makePayload = {
        event_type: "message",
        wa_message_id: message.id,
        from: message.from,
        wa_name: contact?.profile?.name || null,
        message_type: message.type,
        content: content,
        media_id: media_id,
        caption: caption,
        mime_type: mime_type,
        latitude: latitude,
        longitude: longitude,
        location_name: location_name,
        location_address: location_address,
        timestamp: timestamp,
        phone_number_id: metadata?.phone_number_id,
      };

      console.log("📨 Mensaje entrante:", makePayload);

      await fetch(MAKE_WEBHOOK_URL, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(makePayload),
      });
    }

    // ── CASO 2: Status update (delivered/read/failed) ─────
    else if (value.statuses && value.statuses.length > 0) {
      const status = value.statuses[0];

      const makePayload = {
        event_type: "status_update",
        wa_message_id: status.id,
        status: status.status, // sent, delivered, read, failed
        timestamp: status.timestamp,
        recipient_id: status.recipient_id,
      };

      console.log("📊 Status update:", makePayload);

      await fetch(MAKE_WEBHOOK_URL, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(makePayload),
      });
    } else {
      console.log("⚠️ Evento no reconocido, ignorando");
    }

    return new NextResponse("OK", { status: 200 });
  } catch (error) {
    console.error("❌ Error en webhook:", error);
    return new NextResponse("Error", { status: 500 });
  }
}
