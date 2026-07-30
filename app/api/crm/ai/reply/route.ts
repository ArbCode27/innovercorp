import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { getSupabaseAdmin } from "../../_lib/supabase-admin";
import { replyToConversationWithGemini } from "../_lib/reply-to-conversation";

const LOG_PREFIX = "[CRM_AI_REPLY_ROUTE]";

const payloadSchema = z.object({
  conversation_id: z.coerce.number().int().positive(),
  message_id: z.coerce.number().int().positive().optional(),
});

const isAuthorized = (req: NextRequest) => {
  const secret =
    process.env.CRM_INTERNAL_SECRET?.trim() ||
    process.env.SUPABASE_SERVICE_ROLE_KEY?.trim() ||
    "";

  if (!secret) return false;

  const header = req.headers.get("authorization") || "";
  const bearer = header.startsWith("Bearer ") ? header.slice(7).trim() : "";
  const alt = req.headers.get("x-crm-internal-secret")?.trim() || "";

  return bearer === secret || alt === secret;
};

export async function POST(req: NextRequest) {
  try {
    if (!isAuthorized(req)) {
      return NextResponse.json({ error: "No autorizado" }, { status: 401 });
    }

    const payload = payloadSchema.safeParse(await req.json());
    if (!payload.success) {
      return NextResponse.json(
        { error: payload.error.issues[0]?.message || "Datos inválidos" },
        { status: 400 },
      );
    }

    const supabase = getSupabaseAdmin();
    const result = await replyToConversationWithGemini(supabase, {
      conversationId: payload.data.conversation_id,
      triggerMessageId: payload.data.message_id ?? null,
    });

    return NextResponse.json(result);
  } catch (error) {
    console.error(`${LOG_PREFIX} unexpected_error`, error);
    return NextResponse.json(
      {
        error:
          error instanceof Error
            ? error.message
            : "Error interno al generar respuesta IA",
      },
      { status: 500 },
    );
  }
}
