import { NextRequest, NextResponse } from "next/server";
import {
  searchWisproByCedula,
  WisproApiError,
} from "@/app/api/crm/_lib/wispro-api";
import { looksLikeDocumentQuery } from "@/lib/wispro-client-search";
import {
  getWisproClientById,
  searchWisproClients,
  WisproHttpError,
} from "@/lib/wispro";
import type { WisproClientHit } from "@/lib/wispro-types";

export const dynamic = "force-dynamic";

const toSearchError = (error: unknown) => {
  if (error instanceof WisproHttpError || error instanceof WisproApiError) {
    return { message: error.message, status: error.status };
  }
  return {
    message:
      error instanceof Error ? error.message : "No se pudieron buscar clientes",
    status: 502,
  };
};

export async function GET(request: NextRequest) {
  const id = request.nextUrl.searchParams.get("id")?.trim() || "";
  const query = request.nextUrl.searchParams.get("q")?.trim() || "";

  try {
    if (id) {
      const client = await getWisproClientById(id);
      return NextResponse.json({ clients: client ? [client] : [] });
    }

    if (looksLikeDocumentQuery(query)) {
      const results = await searchWisproByCedula(query);
      const clients: WisproClientHit[] = results.map((result) => ({
        id: result.customer.id,
        name: result.customer.name,
        national_identification_number:
          result.customer.national_identification_number || null,
        phone_mobile: result.customer.phone_mobile || null,
      }));
      return NextResponse.json({ clients });
    }

    const clients = await searchWisproClients(query);
    return NextResponse.json({ clients });
  } catch (error) {
    const { message, status } = toSearchError(error);
    return NextResponse.json({ error: message }, { status });
  }
}
