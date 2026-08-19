import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";
import { z } from "zod";
import {
  CRM_PAYMENT_STATUSES,
  approveCrmPayment,
  getCrmPaymentById,
  isCrmPaymentReadyForApproval,
  listCrmPayments,
  markCrmPaymentApprovalError,
  rejectCrmPayment,
} from "@/app/api/crm/_lib/crm-payments";
import { createWisproInvoicingPayment } from "@/app/api/crm/_lib/wispro-api";
import { getCrmSettings } from "@/app/api/crm/_lib/crm-settings";
import { buildPaymentSuccessMessage } from "@/app/crm/_lib/payment-success-message";

const GRAPH_API_VERSION = "v19.0";

const getServerEnv = (key: string) => {
  const value = process.env[key];
  if (!value) throw new Error(`Missing environment variable: ${key}`);
  return value;
};

const getServiceClient = () =>
  createClient(
    getServerEnv("NEXT_PUBLIC_SUPABASE_URL"),
    getServerEnv("SUPABASE_SERVICE_ROLE_KEY"),
  );

const normalizeWhatsAppPhone = (phone: string) => phone.replace(/\D/g, "");

const wasPaymentNotificationSent = (metadata: unknown) => {
  if (!metadata || typeof metadata !== "object") return false;
  const value = (metadata as Record<string, unknown>).payment_loaded_notified_at;
  return typeof value === "string" && value.trim().length > 0;
};

const resolvePaymentRecipientPhone = async (
  supabase: ReturnType<typeof getServiceClient>,
  input: {
    conversationId: number | null;
    clientId: number | null;
  },
) => {
  const knownPhones: string[] = [];

  if (input.conversationId) {
    const { data: conversation } = await supabase
      .from("conversations")
      .select("id, client_id, customer_phone")
      .eq("id", input.conversationId)
      .maybeSingle<{
        id: number;
        client_id: number | null;
        customer_phone: string | null;
      }>();

    if (conversation?.customer_phone) {
      knownPhones.push(normalizeWhatsAppPhone(conversation.customer_phone));
    }

    if (!input.clientId) {
      input.clientId = conversation?.client_id ?? null;
    }
  }

  if (input.clientId) {
    const { data: client } = await supabase
      .from("clients")
      .select("phone, whatsapp_id")
      .eq("id", input.clientId)
      .maybeSingle<{
        phone: string | null;
        whatsapp_id: string | null;
      }>();

    if (client?.whatsapp_id) {
      knownPhones.unshift(normalizeWhatsAppPhone(client.whatsapp_id));
    }
    if (client?.phone) {
      knownPhones.push(normalizeWhatsAppPhone(client.phone));
    }
  }

  const uniquePhones = [...new Set(knownPhones.filter(Boolean))];
  const recipient = uniquePhones.find(
    (phone) => phone.length >= 8 && phone.length <= 15,
  );

  return recipient || null;
};

const sendWhatsAppPaymentApprovedMessage = async (to: string, message: string) => {
  const waResponse = await fetch(
    `https://graph.facebook.com/${GRAPH_API_VERSION}/${getServerEnv(
      "WHATSAPP_PHONE_NUMBER_ID",
    )}/messages`,
    {
      method: "POST",
      headers: {
        Authorization: `Bearer ${getServerEnv("WHATSAPP_TOKEN")}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        messaging_product: "whatsapp",
        recipient_type: "individual",
        to,
        type: "text",
        text: { body: message },
      }),
      cache: "no-store",
    },
  );

  const waData = (await waResponse.json()) as {
    error?: { message?: string };
    messages?: Array<{ id?: string }>;
  };
  if (!waResponse.ok || waData.error) {
    throw new Error(waData.error?.message || "Error al enviar WhatsApp");
  }

  return String(waData.messages?.[0]?.id || "").trim() || null;
};

const notifyClientPaymentApproved = async (
  supabase: ReturnType<typeof getServiceClient>,
  input: {
    payment: NonNullable<Awaited<ReturnType<typeof getCrmPaymentById>>>;
    conversationId: number | null;
  },
) => {
  if (wasPaymentNotificationSent(input.payment.receipt_metadata)) {
    return { sent: false, skipped: "already_sent" as const };
  }

  const recipientPhone = await resolvePaymentRecipientPhone(supabase, {
    conversationId: input.conversationId,
    clientId: input.payment.client_id,
  });
  if (!recipientPhone) {
    return { sent: false, skipped: "missing_phone" as const };
  }

  const settings = await getCrmSettings(supabase);
  const message = buildPaymentSuccessMessage({
    template: settings.payment_success_message,
    paymentDate: input.payment.payment_date,
  });

  const waMessageId = await sendWhatsAppPaymentApprovedMessage(recipientPhone, message);
  const now = new Date().toISOString();

  if (input.conversationId) {
    await supabase.from("messages").insert({
      conversation_id: input.conversationId,
      wa_message_id: waMessageId,
      type: "out",
      content: message,
      sender_type: "bot",
      sent_by: "Bot IA",
      status: "sent",
      metadata: {
        crm_payment_id: input.payment.id,
        payment_loaded_notice: true,
      },
      created_at: now,
    });

    await supabase
      .from("conversations")
      .update({
        preview: message,
        updated_at: now,
        last_message_at: now,
      })
      .eq("id", input.conversationId);
  }

  const nextMetadata = {
    ...(input.payment.receipt_metadata || {}),
    payment_loaded_notified_at: now,
    payment_loaded_notified_wa_message_id: waMessageId,
    payment_loaded_notified_to: recipientPhone,
  };

  await supabase
    .from("crm_payments")
    .update({ receipt_metadata: nextMetadata })
    .eq("id", input.payment.id);

  return { sent: true, skipped: null };
};

const emptyToUndefined = (value: unknown) =>
  value === "" || value === undefined ? undefined : value;

const isoDateSchema = z.preprocess(
  emptyToUndefined,
  z
    .string()
    .regex(/^\d{4}-\d{2}-\d{2}$/, "Fecha inválida")
    .optional(),
);

const optionalText = z.preprocess(
  emptyToUndefined,
  z.string().trim().max(80).optional(),
);

const listQuerySchema = z.object({
  from: isoDateSchema,
  to: isoDateSchema,
  status: z.preprocess(
    emptyToUndefined,
    z.enum(CRM_PAYMENT_STATUSES).optional(),
  ),
  bank: optionalText,
  q: optionalText,
  limit: z.coerce.number().int().min(1).max(200).optional(),
  offset: z.coerce.number().int().min(0).optional(),
});

const patchSchema = z.object({
  id: z.string().uuid(),
  action: z.enum(["approve", "reject"]),
});

export async function GET(req: NextRequest) {
  try {
    const parsed = listQuerySchema.safeParse(
      Object.fromEntries(req.nextUrl.searchParams.entries()),
    );

    if (!parsed.success) {
      return NextResponse.json(
        { error: parsed.error.issues[0]?.message || "Filtros inválidos" },
        { status: 400 },
      );
    }

    const supabase = getServiceClient();
    const result = await listCrmPayments(supabase, parsed.data);

    return NextResponse.json({
      ok: true,
      ...result,
    });
  } catch (error) {
    if (error instanceof Error && error.message.startsWith("Missing environment")) {
      return NextResponse.json(
        { error: "Supabase no está configurado en el servidor" },
        { status: 503 },
      );
    }

    console.error("[CRM_PAYMENTS_API] list_failed", error);
    return NextResponse.json(
      {
        error:
          error instanceof Error
            ? error.message
            : "No se pudieron cargar los pagos",
      },
      { status: 500 },
    );
  }
}

export async function PATCH(req: NextRequest) {
  try {
    const parsed = patchSchema.safeParse(await req.json());
    if (!parsed.success) {
      return NextResponse.json(
        { error: parsed.error.issues[0]?.message || "Datos inválidos" },
        { status: 400 },
      );
    }

    const supabase = getServiceClient();
    const currentPayment = await getCrmPaymentById(supabase, parsed.data.id);

    if (!currentPayment) {
      return NextResponse.json(
        { error: "Pago no encontrado" },
        { status: 404 },
      );
    }

    const canReview =
      currentPayment.status === "RECIBIDO" ||
      currentPayment.status === "EN_PROCESO" ||
      currentPayment.status === "ERROR";
    if (!canReview) {
      return NextResponse.json(
        { error: "Este pago ya fue procesado" },
        { status: 409 },
      );
    }

    if (parsed.data.action === "reject") {
      const payment = await rejectCrmPayment(supabase, currentPayment.id);
      return NextResponse.json({ ok: true, payment });
    }

    if (currentPayment.status === "RECIBIDO") {
      return NextResponse.json(
        { error: "El comprobante aún no tiene todos los datos para aprobarlo" },
        { status: 400 },
      );
    }

    if (!isCrmPaymentReadyForApproval(currentPayment)) {
      return NextResponse.json(
        {
          error:
            "Faltan cédula, monto, banco, referencia o cliente Wispro para aprobar",
        },
        { status: 400 },
      );
    }

    if (!currentPayment.wispro_client_id) {
      return NextResponse.json(
        { error: "El pago no tiene cliente Wispro vinculado" },
        { status: 400 },
      );
    }

    try {
      const wisproPayment = await createWisproInvoicingPayment({
        clientId: currentPayment.wispro_client_id,
        amount: Number(currentPayment.amount),
        paymentDate: currentPayment.payment_date,
        transactionCode: currentPayment.transaction_code,
        comment: [
          "Pago aprobado desde CRM",
          `Banco: ${currentPayment.bank}`,
          `Referencia: ${currentPayment.transaction_code}`,
          currentPayment.comment ? `Comentario: ${currentPayment.comment}` : null,
        ]
          .filter(Boolean)
          .join(" | "),
      });

      const payment = await approveCrmPayment(supabase, {
        payment: currentPayment,
        wisproPayment,
      });

      try {
        await notifyClientPaymentApproved(supabase, {
          payment: payment || currentPayment,
          conversationId: currentPayment.conversation_id,
        });
      } catch (notificationError) {
        const nextMetadata = {
          ...(payment?.receipt_metadata || currentPayment.receipt_metadata || {}),
          payment_loaded_notification_error:
            notificationError instanceof Error
              ? notificationError.message
              : "No se pudo notificar por WhatsApp",
          payment_loaded_notification_error_at: new Date().toISOString(),
        };
        await supabase
          .from("crm_payments")
          .update({ receipt_metadata: nextMetadata })
          .eq("id", currentPayment.id);
      }

      return NextResponse.json({ ok: true, payment, wisproPayment });
    } catch (approvalError) {
      const message =
        approvalError instanceof Error
          ? approvalError.message
          : "No se pudo registrar el pago en Wispro";

      const payment = await markCrmPaymentApprovalError(supabase, {
        paymentId: currentPayment.id,
        message,
      });

      return NextResponse.json(
        {
          ok: false,
          error: message,
          payment,
        },
        { status: 502 },
      );
    }

  } catch (error) {
    if (error instanceof Error && error.message.startsWith("Missing environment")) {
      return NextResponse.json(
        { error: "Supabase no está configurado en el servidor" },
        { status: 503 },
      );
    }

    console.error("[CRM_PAYMENTS_API] update_failed", error);
    return NextResponse.json(
      {
        error:
          error instanceof Error
            ? error.message
            : "No se pudo actualizar el pago",
      },
      { status: 500 },
    );
  }
}
