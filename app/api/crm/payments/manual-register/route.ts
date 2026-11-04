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
  messageId: z.coerce.number().int().positive().optional().nullable(),
  conversationId: z.coerce.number().int().positive().optional().nullable(),
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
  // Direct client fields when registered without message/chat
  clientId: z.coerce.number().int().positive().optional().nullable(),
  wisproClientId: z.string().optional().nullable(),
  clientName: z.string().optional().nullable(),
  cedula: z.string().optional().nullable(),
  phoneId: z.string().optional().nullable(),
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
      clientId,
      wisproClientId,
      clientName,
      cedula,
      phoneId,
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

    // 2. Resolve client and conversation
    let resolvedConversationId: number | null = conversationId ?? null;
    let resolvedClientId: number | null = clientId ?? null;
    let customerPhone: string | null = phoneId?.replace(/\D/g, "") || null;
    let clientIdentity = {
      linked: Boolean(wisproClientId),
      wisproId: wisproClientId || null,
      cedula: cedula?.replace(/\D/g, "") || null,
      name: clientName?.trim() || null,
    };

    if (resolvedConversationId) {
      const { data: conversation } = await supabase
        .from("conversations")
        .select("id, client_id, customer_phone")
        .eq("id", resolvedConversationId)
        .maybeSingle();

      if (conversation) {
        if (!resolvedClientId && conversation.client_id) {
          resolvedClientId = conversation.client_id;
        }
        if (!customerPhone && conversation.customer_phone) {
          customerPhone = conversation.customer_phone.replace(/\D/g, "");
        }
      }
    }

    if (resolvedClientId) {
      const { data: client } = await supabase
        .from("clients")
        .select("id, name, phone, whatsapp_id, wispro_id, envoicing")
        .eq("id", resolvedClientId)
        .maybeSingle();

      if (client) {
        const linked = resolveLinkedClientIdentity(client);
        clientIdentity = {
          linked: linked.linked || Boolean(clientIdentity.wisproId),
          wisproId: linked.wisproId || clientIdentity.wisproId,
          cedula: linked.cedula || clientIdentity.cedula,
          name: linked.name || clientIdentity.name || client.name,
        };
        if (!customerPhone) {
          customerPhone =
            client.whatsapp_id?.replace(/\D/g, "") ||
            client.phone?.replace(/\D/g, "") ||
            null;
        }

        if (!resolvedConversationId) {
          const { data: conv } = await supabase
            .from("conversations")
            .select("id")
            .eq("client_id", client.id)
            .order("updated_at", { ascending: false })
            .limit(1)
            .maybeSingle();
          if (conv) resolvedConversationId = conv.id;
        }
      }
    } else if (clientIdentity.wisproId) {
      const { data: client } = await supabase
        .from("clients")
        .select("id, name, phone, whatsapp_id, wispro_id, envoicing")
        .eq("wispro_id", clientIdentity.wisproId)
        .limit(1)
        .maybeSingle();

      if (client) {
        resolvedClientId = client.id;
        const linked = resolveLinkedClientIdentity(client);
        clientIdentity = {
          linked: true,
          wisproId: linked.wisproId || clientIdentity.wisproId,
          cedula: linked.cedula || clientIdentity.cedula,
          name: linked.name || clientIdentity.name || client.name,
        };
        if (!customerPhone) {
          customerPhone =
            client.whatsapp_id?.replace(/\D/g, "") ||
            client.phone?.replace(/\D/g, "") ||
            null;
        }
        if (!resolvedConversationId) {
          const { data: conv } = await supabase
            .from("conversations")
            .select("id")
            .eq("client_id", client.id)
            .order("updated_at", { ascending: false })
            .limit(1)
            .maybeSingle();
          if (conv) resolvedConversationId = conv.id;
        }
      }
    }

    // 3. Resolve message if messageId was provided
    let messageMediaUrl: string | null = null;
    let originalMessageMetadata: Record<string, unknown> = {};

    if (messageId) {
      const { data: message } = await supabase
        .from("messages")
        .select("id, conversation_id, media_url, metadata")
        .eq("id", messageId)
        .maybeSingle();

      if (message) {
        messageMediaUrl = message.media_url;
        originalMessageMetadata = (message.metadata || {}) as Record<string, unknown>;
      }
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
    let existingPayment = null;
    if (messageId) {
      const { data } = await supabase
        .from("crm_payments")
        .select("id, receipt_metadata")
        .eq("message_id", messageId)
        .maybeSingle();
      existingPayment = data;
    } else if (clientIdentity.cedula && normalizedBank && cleanTransactionCode) {
      const { data } = await supabase
        .from("crm_payments")
        .select("id, receipt_metadata")
        .eq("cedula", clientIdentity.cedula)
        .eq("bank", normalizedBank)
        .eq("transaction_code", cleanTransactionCode)
        .maybeSingle();
      existingPayment = data;
    }

    const receiptMetadata = {
      ...(existingPayment?.receipt_metadata || {}),
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

    let savedPayment = null;

    if (existingPayment?.id) {
      const { data, error: updateError } = await supabase
        .from("crm_payments")
        .update({
          client_id: resolvedClientId,
          conversation_id: resolvedConversationId,
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
          receipt_media_url: messageMediaUrl,
          receipt_metadata: receiptMetadata,
          updated_at: new Date().toISOString(),
        })
        .eq("id", existingPayment.id)
        .select("*")
        .maybeSingle();

      if (updateError) {
        console.error("[MANUAL_REGISTER] payment_update_failed", updateError);
        return NextResponse.json(
          { error: "No se pudo actualizar el registro de pago en CRM" },
          { status: 500 },
        );
      }
      savedPayment = data;
    } else {
      const { data: newPayment, error: insertError } = await supabase
        .from("crm_payments")
        .insert({
          client_id: resolvedClientId,
          conversation_id: resolvedConversationId,
          message_id: messageId ?? null,
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
          receipt_media_url: messageMediaUrl,
          receipt_metadata: receiptMetadata,
        })
        .select("*")
        .maybeSingle();

      if (insertError || !newPayment) {
        console.error("[MANUAL_REGISTER] payment_insert_failed", insertError);
        return NextResponse.json(
          { error: "No se pudo guardar el pago en CRM" },
          { status: 500 },
        );
      }
      savedPayment = newPayment;
    }

    const paymentId = savedPayment?.id;

    // 6. Update message metadata if messageId exists
    if (messageId) {
      const updatedMessageMetadata = {
        ...originalMessageMetadata,
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
    }

    // 7. If notifyClient and registerInWispro, send WhatsApp confirmation
    if (notifyClient && registerInWispro && customerPhone) {
      try {
        const settings = await getCrmSettings(supabase);
        const noticeText = buildPaymentSuccessMessage({
          template: settings.payment_success_message,
          paymentDate,
        });

        const waMsgId = await sendWhatsAppPaymentNotice(customerPhone, noticeText);
        if (waMsgId && resolvedConversationId) {
          const now = new Date().toISOString();
          await supabase.from("messages").insert({
            conversation_id: resolvedConversationId,
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
      payment: savedPayment,
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
