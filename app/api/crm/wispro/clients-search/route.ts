import { NextRequest, NextResponse } from "next/server";
import { searchWisproByCedula } from "@/app/api/crm/_lib/wispro-api";
import { getWisproClientById, searchWisproClients, WisproHttpError } from "@/lib/wispro";
import type { WisproClientHit } from "@/lib/wispro-types";

export const dynamic = "force-dynamic";

const looksLikeDocumentQuery = (value: string) => {
  const compact = value.replace(/[\s.-]/g, "");
  const digits = compact.replace(/\D/g, "");
  return (
    digits.length >= 5 &&
    digits.length <= 12 &&
    /^[VEJGvejg]?\d+$/.test(compact)
  );
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
    const message =
      error instanceof WisproHttpError
        ? error.message
        : error instanceof Error
          ? error.message
          : "No se pudieron buscar clientes";
    const status = error instanceof WisproHttpError ? error.status : 502;
    return NextResponse.json({ error: message }, { status });
  }
}
