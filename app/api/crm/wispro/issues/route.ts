import { NextResponse } from "next/server";
import { listHelpDeskIssues, WisproHttpError } from "@/lib/wispro";

export const dynamic = "force-dynamic";

export async function GET() {
  try {
    const issues = await listHelpDeskIssues();
    return NextResponse.json({ issues });
  } catch (error) {
    const message =
      error instanceof WisproHttpError
        ? error.message
        : error instanceof Error
          ? error.message
          : "No se pudieron cargar los tickets de Wispro";
    const status = error instanceof WisproHttpError ? error.status : 502;
    return NextResponse.json({ error: message }, { status });
  }
}
