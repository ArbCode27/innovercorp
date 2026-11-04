import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import {
  normalizeDocumentDigits,
  searchWisproByCedula,
  fetchInvoicingForWisproClientId,
  WisproApiError,
} from "@/app/api/crm/_lib/wispro-api";
import { searchWisproClients } from "@/lib/wispro";
import { looksLikeDocumentQuery } from "@/lib/wispro-client-search";
import type { WisproSearchResult } from "@/app/crm/_lib/types";

const LOG_PREFIX = "[WISPRO_SEARCH]";

const searchSchema = z.object({
  query: z.string().trim().optional(),
  cedula: z.string().trim().optional(),
});

export async function POST(req: NextRequest) {
  try {
    const body = await req.json();
    const parsed = searchSchema.safeParse(body);

    if (!parsed.success) {
      return NextResponse.json(
        { error: parsed.error.issues[0]?.message || "Datos inválidos" },
        { status: 400 },
      );
    }

    const raw = (parsed.data.query || parsed.data.cedula || "").trim();
    if (!raw || raw.length < 2) {
      return NextResponse.json(
        { error: "Ingresa al menos 2 caracteres para buscar" },
        { status: 400 },
      );
    }

    const isDocument = looksLikeDocumentQuery(raw) || /^\d{5,12}$/.test(normalizeDocumentDigits(raw));

    let results: WisproSearchResult[] = [];

    if (isDocument) {
      const digits = normalizeDocumentDigits(raw);
      if (digits.length >= 5) {
        results = await searchWisproByCedula(digits);
      }
    } else {
      // Name search in Wispro
      const hits = await searchWisproClients(raw);

      // Fetch live invoicing for each hit up to 10
      const settled = await Promise.allSettled(
        hits.slice(0, 10).map(async (hit) => {
          try {
            const { invoicing } = await fetchInvoicingForWisproClientId(hit.id);
            return {
              customer: {
                id: hit.id,
                name: hit.name,
                national_identification_number: hit.national_identification_number || "",
                phone_mobile: hit.phone_mobile || null,
              },
              invoicing,
            } satisfies WisproSearchResult;
          } catch {
            return {
              customer: {
                id: hit.id,
                name: hit.name,
                national_identification_number: hit.national_identification_number || "",
                phone_mobile: hit.phone_mobile || null,
              },
              invoicing: {
                debt: 0,
                hasDebt: false,
                accountStatus: "Al día",
                serviceSuspended: false,
                contractState: null,
                snapshot: null,
              },
            } satisfies WisproSearchResult;
          }
        }),
      );

      results = settled
        .filter((item): item is PromiseFulfilledResult<WisproSearchResult> => item.status === "fulfilled")
        .map((item) => item.value);
    }

    return NextResponse.json({ data: results });
  } catch (error) {
    if (error instanceof WisproApiError) {
      console.error(`${LOG_PREFIX} wispro_error`, {
        code: error.code,
        message: error.message,
      });
      return NextResponse.json(
        { error: error.message },
        { status: error.status },
      );
    }

    console.error(`${LOG_PREFIX} unexpected_error`, error);
    return NextResponse.json(
      { error: "Error interno al consultar Wispro" },
      { status: 500 },
    );
  }
}
