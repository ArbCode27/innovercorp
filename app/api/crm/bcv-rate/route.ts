import { NextResponse } from "next/server";
import { getBcvRate } from "@/app/api/crm/_lib/dolarvzla-rate";

export const dynamic = "force-dynamic";

export async function GET() {
  try {
    const snapshot = await getBcvRate();
    return NextResponse.json({
      ok: true,
      rate: snapshot.rate,
      usd: snapshot.usd,
      eur: snapshot.eur,
      asOf: snapshot.asOf,
      source: snapshot.source,
      cached: snapshot.cached,
    });
  } catch (error) {
    console.error("[BCV_RATE_API] error", error);
    return NextResponse.json(
      {
        ok: false,
        error:
          error instanceof Error
            ? error.message
            : "No se pudo consultar la tasa BCV",
      },
      { status: 502 },
    );
  }
}
