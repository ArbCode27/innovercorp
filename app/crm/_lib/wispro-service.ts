import type {
  Client,
  WisproInvoicingSummary,
  WisproSearchResult,
} from "./types";

interface WisproSearchPayload {
  data?: WisproSearchResult[];
  webhookRaw?: string;
  webhookParsed?: unknown;
  error?: string;
}

interface WisproApiPayload {
  data?: WisproSearchResult[];
  client?: Client;
  error?: string;
}

const parseApiError = (payload: WisproApiPayload, fallback: string) => {
  throw new Error(payload.error || fallback);
};

export const wisproService = {
  async searchByCedula(cedula: string): Promise<WisproSearchResult[]> {
    const response = await fetch("/api/crm/wispro/search", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ cedula }),
    });

    const payload = (await response.json()) as WisproSearchPayload;

    if (!response.ok) {
      parseApiError(payload, "Error al consultar Wispro");
    }

    console.log("[Wispro webhook] respuesta literal del webhook:", payload.webhookRaw);
    console.log("[Wispro webhook] respuesta parseada (sin transformar):", payload.webhookParsed);

    return payload.data || [];
  },

  async associateToConversation(input: {
    conversationId: number;
    customer: WisproSearchResult["customer"];
    invoicing: WisproInvoicingSummary;
    existingClientId?: number | null;
    conversationPhone?: string | null;
    whatsappId?: string | null;
    waName?: string | null;
  }): Promise<Client> {
    const response = await fetch("/api/crm/wispro/associate", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(input),
    });

    const payload = (await response.json()) as WisproApiPayload;

    if (!response.ok) {
      parseApiError(payload, "No se pudo asociar el cliente");
    }

    if (!payload.client) {
      throw new Error("No se recibió el cliente asociado");
    }

    return payload.client;
  },
};
