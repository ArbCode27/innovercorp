import { NextRequest, NextResponse } from "next/server";
import { listContractsForClient, WisproHttpError } from "@/lib/wispro";

export const dynamic = "force-dynamic";

export async function GET(request: NextRequest) {
  const clientId = request.nextUrl.searchParams.get("clientId")?.trim() || "";
  if (!clientId) {
    return NextResponse.json({ error: "clientId es requerido" }, { status: 400 });
  }

  try {
    const contracts = await listContractsForClient(clientId);
    return NextResponse.json({ contracts });
  } catch (error) {
    const message =
      error instanceof WisproHttpError
        ? error.message
        : error instanceof Error
          ? error.message
          : "No se pudieron cargar los contratos";
    const status = error instanceof WisproHttpError ? error.status : 502;
    return NextResponse.json({ error: message }, { status });
  }
}
