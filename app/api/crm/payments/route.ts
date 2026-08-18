import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";
import { z } from "zod";
import {
  CRM_PAYMENT_STATUSES,
  approveCrmPayment,
  getCrmPaymentById,
  listCrmPayments,
  markCrmPaymentApprovalError,
  rejectCrmPayment,
} from "@/app/api/crm/_lib/crm-payments";
import { createWisproInvoicingPayment } from "@/app/api/crm/_lib/wispro-api";

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
      currentPayment.status === "EN_PROCESO" || currentPayment.status === "ERROR";
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
