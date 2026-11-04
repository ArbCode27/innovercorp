import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";
import { z } from "zod";
import {
  createWisproInvoicingPayment,
  listPendingInvoicesForClient,
  resolvePlanPriceForClient,
} from "@/app/api/crm/_lib/wispro-api";
import { matchInvoicesToPaymentAmount } from "@/app/api/crm/_lib/wispro-invoice-match";
import { resolveLinkedClientIdentity } from "@/app/crm/_lib/client-profile-utils";
import { normalizeReceptorBank } from "@/app/crm/_lib/payments";
import { getCrmSettings } from "@/app/api/crm/_lib/crm-settings";
import { buildPaymentSuccessMessage } from "@/app/crm/_lib/payment-success-message";

const GRAPH_API_VERSION = "v19.0";

const payloadSchema = z.object({
  messageId: z.coerce.number().int().positive(),
  conversationId: z.coerce.number().int().positive(),
  agentId: z.coerce.number().int().positive(),
  amountUsd: z.coerce.number().positive(),
  amountBs: z.coerce.number().positive().optional().nullable(),
  bcvRate: z.coerce.number().positive().optional().nullable(),
  bank: z.string().min(1),
  transactionCode: z.string().min(3),
  paymentDate: z.string().regex(/^\d{4}-\d{2}-\d{2}$/),
  comment: z.string().optional().nullable(),
  registerInWispro: z.boolean().default(true),
  notifyClient: z.boolean().default(true),
});

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

const sendWhatsAppPaymentNotice = async (to: string, message: string) => {
  const token = process.env.WHATSAPP_TOKEN;
  const phoneNumberId = process.env.WHATSAPP_PHONE_NUMBER_ID;
  if (!token || !phoneNumberId) return null;

  try {
    const waResponse = await fetch(
      `https://graph.facebook.com/${GRAPH_API_VERSION}/${phoneNumberId}/messages`,
      {
        method: "POST",
        headers: {
          Authorization: `Bearer ${token}`,
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          messaging_product: "whatsapp",
          recipient_type: "individual",
          to,
          type: "text",
          text: { body: message },
        }),
      },
    );
    const data = await waResponse.json();
    return String(data?.messages?.[0]?.id || "").trim() || null;
  } catch (error) {
    console.warn("[MANUAL_REGISTER] whatsapp_notice_failed", error);
    return null;
  }
};

export async function POST(req: NextRequest) {
  try {
    const body = await req.json();
    const parsed = payloadSchema.safeParse(body);

    if (!parsed.success) {
      return NextResponse.json(
        { error: parsed.error.issues[0]?.message || "Datos del pago inválidos" },
        { status: 400 },
      );
    }

    const {
      messageId,
      conversationId,
      agentId,
      amountUsd,
      amountBs,
      bcvRate,
      bank,
      transactionCode,
      paymentDate,
      comment,
      registerInWispro,
      notifyClient,
    } = parsed.data;

    const supabase = getServiceClient();

    // 1. Validate agent
    const { data: agent, error: agentError } = await supabase
      .from("agents")
      .select("id, name, role")
      .eq("id", agentId)
      .maybeSingle();

    if (agentError || !agent) {
      return NextResponse.json(
        { error: "El asesor no existe o no tiene permisos" },
        { status: 403 },
      );
    }

    // 2. Validate conversation & client
    const { data: conversation } = await supabase
      .from("conversations")
      .select("id, client_id, customer_phone")
      .eq("id", conversationId)
      .maybeSingle();

    if (!conversation) {
      return NextResponse.json(
        { error: "La conversación no existe" },
        { status: 404 },
      );
    }

    let clientIdentity = {
      linked: false,
      wisproId: null as string | null,
      cedula: null as string | null,
      name: null as string | null,
    };
    let customerPhone = conversation.customer_phone?.replace(/\D/g, "") || null;

    if (conversation.client_id) {
      const { data: client } = await supabase
        .from("clients")
        .select("id, name, phone, whatsapp_id, wispro_id, envoicing")
        .eq("id", conversation.client_id)
        .maybeSingle();

      if (client) {
        clientIdentity = resolveLinkedClientIdentity(client);
        if (!customerPhone) {
          customerPhone =
            client.whatsapp_id?.replace(/\D/g, "") ||
            client.phone?.replace(/\D/g, "") ||
            null;
        }
      }
    }

    // 3. Validate message
    const { data: message } = await supabase
      .from("messages")
      .select("id, conversation_id, media_url, metadata")
      .eq("id", messageId)
      .maybeSingle();

    if (!message) {
      return NextResponse.json(
        { error: "El mensaje del comprobante no existe" },
        { status: 404 },
      );
    }

    const cleanTransactionCode = transactionCode.replace(/\D/g, "");
    const normalizedBank = normalizeReceptorBank(bank) || bank.trim();

    let wisproPaymentResult: unknown = null;
    let externalPaymentId: string | null = null;
    let externalApiStatus: number | null = null;
    let paymentStatus = registerInWispro ? "APROBADO" : "EN_PROCESO";
    let wisproInvoiceMatchMeta: Record<string, unknown> | null = null;

    // 4. If registerInWispro is selected, create invoicing payment in Wispro
    if (registerInWispro) {
      if (!clientIdentity.linked || !clientIdentity.wisproId) {
        return NextResponse.json(
          {
            error:
              "El cliente no está vinculado a Wispro. Vincúlalo primero o desmarca 'Registrar en Wispro'.",
          },
          { status: 409 },
        );
      }

      if (!clientIdentity.cedula) {
        return NextResponse.json(
          {
            error:
              "El cliente no tiene cédula registrada. Vuelve a asociarlo a Wispro antes de registrar el pago.",
          },
          { status: 409 },
        );
      }

      try {
        let pendingInvoices: Awaited<ReturnType<typeof listPendingInvoicesForClient>> = [];
        try {
          pendingInvoices = await listPendingInvoicesForClient({
            wisproClientId: clientIdentity.wisproId,
            cedula: clientIdentity.cedula,
          });
        } catch (invoiceErr) {
          console.warn("[MANUAL_REGISTER] list_pending_invoices_soft_fail", invoiceErr);
        }

        const planAmount = await resolvePlanPriceForClient({
          wisproClientId: clientIdentity.wisproId,
        }).catch(() => null);

        const match = matchInvoicesToPaymentAmount(
          pendingInvoices.map((inv) => ({
            id: inv.id,
            balance: inv.balance,
            amount: inv.amount,
            issuedAt: inv.issued_at,
            firstDueDate: inv.first_due_date,
            invoiceNumber: inv.invoice_number,
            state: inv.state,
          })),
          amountUsd,
          { fallbackExpected: planAmount },
        );

        wisproInvoiceMatchMeta = {
          attempted_at: new Date().toISOString(),
          strategy: match.strategy,
          invoice_ids: match.invoiceIds,
          matched_amount: match.matchedAmount,
          post_amount: match.postAmount,
          invoices: match.invoices,
        };

        const postAmount = match.postAmount || amountUsd;
        const wisproCreated = await createWisproInvoicingPayment({
          clientId: clientIdentity.wisproId,
          amount: postAmount,
          paymentDate,
          transactionCode: cleanTransactionCode,
          comment:
            comment?.trim() ||
            `Pago registrado desde CRM por asesor ${agent.name || agent.id}`,
          invoiceIds: match.invoiceIds,
        });

        wisproPaymentResult = wisproCreated;
        externalPaymentId = wisproCreated.id;
        externalApiStatus = 200;
        paymentStatus = "APROBADO";
      } catch (wisproErr) {
        console.error("[MANUAL_REGISTER] wispro_payment_failed", wisproErr);
        return NextResponse.json(
          {
            error:
              wisproErr instanceof Error
                ? wisproErr.message
                : "No se pudo registrar el pago en Wispro",
          },
          { status: 502 },
        );
      }
    }

    // 5. Upsert into crm_payments
    const existingPaymentQuery = await supabase
      .from("crm_payments")
      .select("id, receipt_metadata")
      .eq("message_id", messageId)
      .maybeSingle();

    const receiptMetadata = {
      ...(existingPaymentQuery.data?.receipt_metadata || {}),
      manual_registered: true,
      registered_by_agent_id: agentId,
      registered_by_agent_name: agent.name,
      amount_bs: amountBs || null,
      amount_usd: amountUsd,
      bcv_rate: bcvRate || null,
      registered_at: new Date().toISOString(),
      registered_in_wispro: registerInWispro,
      wispro_payment: wisproPaymentResult,
      wispro_invoice_match: wisproInvoiceMatchMeta,
    };

    let paymentId: string;

    if (existingPaymentQuery.data?.id) {
      paymentId = existingPaymentQuery.data.id;
      const { error: updateError } = await supabase
        .from("crm_payments")
        .update({
          client_id: conversation.client_id,
          conversation_id: conversationId,
          submitted_by_agent_id: agentId,
          wispro_client_id: clientIdentity.wisproId,
          client_name: clientIdentity.name,
          cedula: clientIdentity.cedula,
          phone_id: customerPhone,
          amount: amountUsd,
          amount_raw: String(amountBs || amountUsd),
          bank: normalizedBank,
          transaction_code: cleanTransactionCode,
          payment_date: paymentDate,
          comment: comment?.trim() || null,
          status: paymentStatus,
          external_payment_id: externalPaymentId,
          external_api_status: externalApiStatus,
          receipt_media_url: message.media_url,
          receipt_metadata: receiptMetadata,
          updated_at: new Date().toISOString(),
        })
        .eq("id", paymentId);

      if (updateError) {
        console.error("[MANUAL_REGISTER] payment_update_failed", updateError);
        return NextResponse.json(
          { error: "No se pudo actualizar el registro de pago en CRM" },
          { status: 500 },
        );
      }
    } else {
      const { data: newPayment, error: insertError } = await supabase
        .from("crm_payments")
        .insert({
          client_id: conversation.client_id,
          conversation_id: conversationId,
          message_id: messageId,
          submitted_by_agent_id: agentId,
          wispro_client_id: clientIdentity.wisproId,
          client_name: clientIdentity.name,
          cedula: clientIdentity.cedula,
          phone_id: customerPhone,
          amount: amountUsd,
          amount_raw: String(amountBs || amountUsd),
          bank: normalizedBank,
          transaction_code: cleanTransactionCode,
          payment_date: paymentDate,
          comment: comment?.trim() || null,
          status: paymentStatus,
          source: "advisor",
          external_payment_id: externalPaymentId,
          external_api_status: externalApiStatus,
          receipt_media_url: message.media_url,
          receipt_metadata: receiptMetadata,
        })
        .select("id")
        .maybeSingle();

      if (insertError || !newPayment) {
        console.error("[MANUAL_REGISTER] payment_insert_failed", insertError);
        return NextResponse.json(
          { error: "No se pudo guardar el pago en CRM" },
          { status: 500 },
        );
      }
      paymentId = newPayment.id;
    }

    // 6. Update message metadata to mark payment as registered
    const updatedMessageMetadata = {
      ...(message.metadata || {}),
      payment_registered: true,
      payment_registered_at: new Date().toISOString(),
      payment_registered_by: agentId,
      crm_payment_id: paymentId,
      payment_amount: amountUsd,
      payment_amount_bs: amountBs || null,
      payment_bank: normalizedBank,
      payment_transaction_code: cleanTransactionCode,
      payment_in_wispro: registerInWispro,
    };

    await supabase
      .from("messages")
      .update({ metadata: updatedMessageMetadata })
      .eq("id", messageId);

    // 7. If notifyClient and registerInWispro, send WhatsApp confirmation
    if (notifyClient && registerInWispro && customerPhone) {
      try {
        const settings = await getCrmSettings(supabase);
        const noticeText = buildPaymentSuccessMessage({
          template: settings.payment_success_message,
          paymentDate,
        });

        const waMsgId = await sendWhatsAppPaymentNotice(customerPhone, noticeText);
        if (waMsgId) {
          const now = new Date().toISOString();
          await supabase.from("messages").insert({
            conversation_id: conversationId,
            wa_message_id: waMsgId,
            type: "out",
            content: noticeText,
            sender_type: "agent",
            sent_by: agent.name || "Asesor",
            status: "sent",
            metadata: {
              crm_payment_id: paymentId,
              manual_payment_loaded_notice: true,
            },
            created_at: now,
          });
        }
      } catch (noticeError) {
        console.warn("[MANUAL_REGISTER] notification_error", noticeError);
      }
    }

    return NextResponse.json({
      ok: true,
      paymentId,
      status: paymentStatus,
      registeredInWispro: registerInWispro,
      wisproPayment: wisproPaymentResult,
      amountUsd,
      amountBs,
      bank: normalizedBank,
      transactionCode: cleanTransactionCode,
    });
  } catch (error) {
    console.error("[MANUAL_REGISTER] unexpected_error", error);
    return NextResponse.json(
      {
        error:
          error instanceof Error
            ? error.message
            : "Error interno al registrar el pago",
      },
      { status: 500 },
    );
  }
}
