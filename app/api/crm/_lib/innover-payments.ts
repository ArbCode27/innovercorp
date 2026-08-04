const LOG_PREFIX = "[INNOVER_PAYMENTS]";
const DEFAULT_PAYMENTS_URL =
  "https://backend-innover.vercel.app/api/v1/payments";
const REQUEST_TIMEOUT_MS = 20_000;

export type InnoverPaymentPayload = {
  client_id: string;
  amount: number;
  transaction_code: number;
  bank: string;
  name: string;
  cedula: string;
  phone_id: string;
};

export class InnoverPaymentsError extends Error {
  readonly status: number;
  readonly body: string | null;

  constructor(message: string, status: number, body: string | null = null) {
    super(message);
    this.name = "InnoverPaymentsError";
    this.status = status;
    this.body = body;
  }
}

const getPaymentsUrl = () =>
  process.env.INNOVER_PAYMENTS_API_URL?.trim() || DEFAULT_PAYMENTS_URL;

export const submitInnoverPayment = async (
  payload: InnoverPaymentPayload,
): Promise<{ status: number; body: unknown }> => {
  const url = getPaymentsUrl();
  const headers: Record<string, string> = {
    "Content-Type": "application/json",
    Accept: "application/json",
  };

  const apiKey = process.env.INNOVER_PAYMENTS_API_KEY?.trim();
  if (apiKey) {
    headers.Authorization = `Bearer ${apiKey}`;
  }

  console.log(`${LOG_PREFIX} submit_started`, {
    url,
    clientId: payload.client_id,
    amount: payload.amount,
    bank: payload.bank,
    cedula: payload.cedula,
    phoneId: payload.phone_id,
  });

  let response: Response;
  try {
    response = await fetch(url, {
      method: "POST",
      headers,
      body: JSON.stringify(payload),
      signal: AbortSignal.timeout(REQUEST_TIMEOUT_MS),
      cache: "no-store",
    });
  } catch (error) {
    console.error(`${LOG_PREFIX} request_failed`, {
      error: error instanceof Error ? error.message : "unknown_error",
    });
    throw new InnoverPaymentsError(
      "No se pudo conectar con el API de pagos Innover",
      502,
    );
  }

  const rawBody = await response.text();
  let parsed: unknown = null;
  if (rawBody) {
    try {
      parsed = JSON.parse(rawBody);
    } catch {
      parsed = rawBody;
    }
  }

  if (!response.ok) {
    console.error(`${LOG_PREFIX} submit_rejected`, {
      status: response.status,
      body: rawBody.slice(0, 500),
    });
    throw new InnoverPaymentsError(
      "El API de pagos rechazó el comprobante",
      response.status,
      rawBody || null,
    );
  }

  console.log(`${LOG_PREFIX} submit_ok`, {
    status: response.status,
  });

  return { status: response.status, body: parsed };
};
