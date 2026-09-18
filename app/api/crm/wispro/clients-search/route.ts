import { NextRequest, NextResponse } from "next/server";
import { getWisproClientById, searchWisproClients, WisproHttpError } from "@/lib/wispro";

export const dynamic = "force-dynamic";

export async function GET(request: NextRequest) {
  const id = request.nextUrl.searchParams.get("id")?.trim() || "";
  const query = request.nextUrl.searchParams.get("q")?.trim() || "";

  try {
    if (id) {
      const client = await getWisproClientById(id);
      return NextResponse.json({ clients: client ? [client] : [] });
    }

    const clients = await searchWisproClients(query);
    return NextResponse.json({ clients });
  } catch (error) {
    const message =
      error instanceof WisproHttpError
        ? error.message
        : error instanceof Error
          ? error.message
          : "No se pudieron buscar clientes en Wispro";
    const status = error instanceof WisproHttpError ? error.status : 502;
    return NextResponse.json({ error: message }, { status });
  }
}
