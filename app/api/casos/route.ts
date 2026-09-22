import { NextRequest, NextResponse } from "next/server";
import {
  createCaso,
  listTechnicians,
  reassignHelpDeskIssue,
  retryCasoSteps,
  WisproHttpError,
} from "@/lib/wispro";
import {
  createCasoSchema,
  manageCasoSchema,
  retryCasoSchema,
} from "@/app/crm/_lib/wispro-caso-schema";
import { getSupabaseAdmin } from "@/app/api/crm/_lib/supabase-admin";
import {
  deleteCrmWisproCaso,
  getCrmWisproCasoByIssueId,
  listCrmWisproCasos,
  patchCrmWisproCaso,
  upsertCrmWisproCaso,
  type UpsertCrmWisproCasoInput,
} from "@/lib/crm-wispro-casos";
import { upsertCrmTechnicianFromEmployee } from "@/lib/crm-technicians";
import {
  FinalizeCasoError,
  finalizeCrmWisproCaso,
} from "@/lib/finalize-crm-caso";
import {
  parseCoordsFromMapsUrl,
  resolveMapsUrl,
  withMapsInDescription,
} from "@/lib/maps-link";
import type { CreateCasoInput, RetryCasoInput } from "@/app/crm/_lib/wispro-caso-schema";
import type { CrmWisproCasoStatus, ResultadoCaso } from "@/lib/wispro-types";

export const dynamic = "force-dynamic";

const hasGps = (gps: {
  latitude?: number;
  longitude?: number;
} | null | undefined) =>
  Boolean(
    gps &&
      Number.isFinite(gps.latitude) &&
      Number.isFinite(gps.longitude),
  );

const resolveStatus = (input: {
  employeeId?: string | null;
  startAt?: string | null;
  endAt?: string | null;
}): CrmWisproCasoStatus =>
  input.employeeId && input.startAt && input.endAt ? "scheduled" : "open";

const resolveEmployee = async (employeeId?: string | null) => {
  if (!employeeId) return null;
  try {
    const employees = await listTechnicians();
    return employees.find((item) => item.id === employeeId) || null;
  } catch {
    return null;
  }
};

const buildFichaInput = async (
  input: Pick<
    CreateCasoInput,
    | "conversationId"
    | "crmClientId"
    | "clientId"
    | "clientName"
    | "clientPhone"
    | "cause"
    | "mapsUrl"
    | "addressText"
    | "facadeMediaUrl"
    | "facadeMessageId"
    | "employeeId"
    | "kind"
    | "title"
    | "description"
    | "startAt"
    | "endAt"
    | "gps"
    | "priority"
  > & {
    wisproIssueId: string;
    wisproPublicId?: number | null;
    wisproOrderId?: string | null;
    employeeDocument?: string | null;
  },
): Promise<UpsertCrmWisproCasoInput> => {
  const employee = await resolveEmployee(input.employeeId);
  const coords =
    hasGps(input.gps) && input.gps
      ? { latitude: Number(input.gps.latitude), longitude: Number(input.gps.longitude) }
      : parseCoordsFromMapsUrl(input.mapsUrl);
  const mapsUrl = resolveMapsUrl({
    mapsUrl: input.mapsUrl,
    latitude: coords?.latitude ?? null,
    longitude: coords?.longitude ?? null,
  });
  const addressText =
    input.addressText ||
    [input.gps?.street, input.gps?.number, input.gps?.city]
      .map((value) => String(value || "").trim())
      .filter(Boolean)
      .join(" ") ||
    null;

  return {
    conversationId: input.conversationId ?? null,
    crmClientId: input.crmClientId ?? null,
    wisproClientId: input.clientId ?? null,
    wisproIssueId: input.wisproIssueId,
    wisproPublicId: input.wisproPublicId ?? null,
    wisproOrderId: input.wisproOrderId ?? null,
    employeeId: input.employeeId ?? employee?.id ?? null,
    employeeName: employee?.name ?? null,
    employeePhone: employee?.phone_mobile || employee?.phone || null,
    employeeDocument:
      employee?.national_identification_number ?? input.employeeDocument ?? null,
    status: resolveStatus(input),
    priority: input.priority || "medium",
    kind: input.kind ?? null,
    title: input.title,
    cause: input.cause || input.title,
    description: input.description,
    clientName: input.clientName ?? null,
    clientPhone: input.clientPhone ?? null,
    mapsUrl,
    latitude: coords?.latitude ?? null,
    longitude: coords?.longitude ?? null,
    addressText,
    facadeMediaUrl: input.facadeMediaUrl ?? null,
    facadeMessageId: input.facadeMessageId ?? null,
    windowStart: input.startAt ?? null,
    windowEnd: input.endAt ?? null,
  };
};

const persistFicha = async (
  result: ResultadoCaso,
  input: Omit<
    Parameters<typeof buildFichaInput>[0],
    "wisproIssueId" | "wisproPublicId" | "wisproOrderId"
  > & {
    wisproPublicId?: number | null;
    wisproOrderId?: string | null;
  },
): Promise<ResultadoCaso> => {
  if (!result.ticket.ok) {
    return { ...result, crm: { ok: null } };
  }

  try {
    const supabase = getSupabaseAdmin();
    const ficha = await upsertCrmWisproCaso(
      supabase,
      await buildFichaInput({
        ...input,
        wisproIssueId: result.ticket.id,
        wisproPublicId: result.ticket.publicId ?? input.wisproPublicId ?? null,
        wisproOrderId: result.orden.ok === true ? result.orden.id : input.wisproOrderId ?? null,
        title: input.title,
        description: input.description,
      }),
    );
    const employee = await resolveEmployee(input.employeeId);
    if (employee) {
      void upsertCrmTechnicianFromEmployee(supabase, employee).catch((error) => {
        console.warn("[CASOS] technician_upsert_failed", error);
      });
    }
    return { ...result, crm: { ok: true, id: ficha.id } };
  } catch (error) {
    console.error("[CASOS] crm_ficha_failed", error);
    return {
      ...result,
      crm: {
        ok: false,
        error:
          error instanceof Error
            ? error.message
            : "No se guardó la ficha CRM del ticket",
      },
    };
  }
};

export async function GET(request: NextRequest) {
  try {
    const supabase = getSupabaseAdmin();
    const issueId = request.nextUrl.searchParams.get("issueId")?.trim();
    if (issueId) {
      const caso = await getCrmWisproCasoByIssueId(supabase, issueId);
      if (!caso) {
        return NextResponse.json({ error: "No existe ese ticket" }, { status: 404 });
      }
      return NextResponse.json({
        caso: {
          ...caso,
          hasFacade: Boolean(caso.hasFacade || caso.facadeMediaUrl),
        },
      });
    }

    const casos = await listCrmWisproCasos(supabase);
    return NextResponse.json({
      casos: casos.map((caso) => ({
        ...caso,
        facadeMediaUrl: null,
        hasFacade: Boolean(caso.hasFacade || caso.facadeMediaUrl),
      })),
    });
  } catch (error) {
    const message =
      error instanceof Error ? error.message : "No se pudieron listar los casos";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}

export async function POST(request: NextRequest) {
  try {
    const parsed = createCasoSchema.safeParse(await request.json());
    if (!parsed.success) {
      return NextResponse.json(
        { error: parsed.error.issues[0]?.message || "Datos inválidos" },
        { status: 400 },
      );
    }

    const input = parsed.data;
    const mapsUrl = resolveMapsUrl({
      mapsUrl: input.mapsUrl,
      latitude: input.gps?.latitude ?? null,
      longitude: input.gps?.longitude ?? null,
    });
    const description = withMapsInDescription(input.description, mapsUrl);

    const result = await createCaso({
      issue: {
        title: input.title,
        description,
        categoryId: input.categoryId,
        clientId: input.clientId,
        contractId: input.contractId,
        assignableId: input.assignableId,
      },
      order: input.generateOrder
        ? {
            kind: input.kind,
            description: input.orderDescription,
            ticketId: "",
            contractId: input.contractId,
            startAt: input.startAt,
            endAt: input.endAt,
            gps: hasGps(input.gps) ? input.gps : null,
          }
          : null,
    });

    const withFicha = await persistFicha(result, {
      ...input,
      mapsUrl,
      description,
    });

    return NextResponse.json(withFicha);
  } catch (error) {
    const message =
      error instanceof WisproHttpError
        ? error.message
        : error instanceof Error
          ? error.message
          : "No se pudo crear el caso en Wispro";
    const status = error instanceof WisproHttpError ? error.status : 500;
    return NextResponse.json({ error: message }, { status });
  }
}

export async function PATCH(request: NextRequest) {
  try {
    const parsed = retryCasoSchema.safeParse(await request.json());
    if (!parsed.success) {
      return NextResponse.json(
        { error: parsed.error.issues[0]?.message || "Datos inválidos" },
        { status: 400 },
      );
    }

    const input = parsed.data as RetryCasoInput;
    let existing = null;
    try {
      existing = await getCrmWisproCasoByIssueId(getSupabaseAdmin(), input.ticketId);
    } catch (error) {
      console.error("[CASOS] load_ficha_on_retry_failed", error);
    }
    const result = await retryCasoSteps({
      ticketId: input.ticketId,
      existingOrderId: input.existingOrderId,
      order:
        input.generateOrder && !input.existingOrderId
          ? {
              kind: input.kind,
              description: input.orderDescription,
              ticketId: input.ticketId,
              contractId: input.contractId,
              startAt: input.startAt,
              endAt: input.endAt,
              gps: hasGps(input.gps) ? input.gps : null,
            }
          : null,
    });

    const withFicha = await persistFicha(result, {
      ...input,
      conversationId: input.conversationId ?? existing?.conversationId ?? null,
      crmClientId: input.crmClientId ?? existing?.crmClientId ?? null,
      clientId: existing?.wisproClientId ?? null,
      clientName: input.clientName ?? existing?.clientName ?? null,
      clientPhone: input.clientPhone ?? existing?.clientPhone ?? null,
      cause: input.cause ?? existing?.cause ?? null,
      mapsUrl: input.mapsUrl ?? existing?.mapsUrl ?? null,
      addressText: input.addressText ?? existing?.addressText ?? null,
      facadeMediaUrl: input.facadeMediaUrl ?? existing?.facadeMediaUrl ?? null,
      facadeMessageId: input.facadeMessageId ?? existing?.facadeMessageId ?? null,
      title: existing?.title || input.cause || "Ticket Wispro",
      description: existing?.description || input.orderDescription || "Ticket Wispro",
      priority: existing?.priority || "medium",
      kind: input.kind ?? existing?.kind ?? "technical",
      wisproPublicId: input.publicId ?? existing?.wisproPublicId,
      wisproOrderId: result.orden.ok === true ? result.orden.id : existing?.wisproOrderId,
      employeeDocument: existing?.employeeDocument,
      gps: input.gps ?? (existing?.latitude != null && existing?.longitude != null
        ? {
            latitude: existing.latitude,
            longitude: existing.longitude,
          }
        : null),
    });

    return NextResponse.json(withFicha);
  } catch (error) {
    const message =
      error instanceof WisproHttpError
        ? error.message
        : error instanceof Error
          ? error.message
          : "No se pudo reintentar el caso";
    const status = error instanceof WisproHttpError ? error.status : 500;
    return NextResponse.json({ error: message }, { status });
  }
}

export async function PUT(request: NextRequest) {
  try {
    const parsed = manageCasoSchema.safeParse(await request.json());
    if (!parsed.success) {
      return NextResponse.json(
        { error: parsed.error.issues[0]?.message || "Datos inválidos" },
        { status: 400 },
      );
    }

    const supabase = getSupabaseAdmin();
    const existing = await getCrmWisproCasoByIssueId(
      supabase,
      parsed.data.issueId,
    );
    if (!existing) {
      return NextResponse.json(
        { error: "No existe la ficha CRM de este ticket" },
        { status: 404 },
      );
    }

    if (parsed.data.action === "finalize") {
      const { caso, issue, order } = await finalizeCrmWisproCaso(supabase, {
        issueId: parsed.data.issueId,
        resolutionObservation: parsed.data.resolutionObservation,
        resolutionSolution: parsed.data.resolutionSolution,
        clientStatus: parsed.data.clientStatus,
      });
      return NextResponse.json({
        ok: true,
        action: "finalize",
        caso: {
          ...caso,
          facadeMediaUrl: null,
          hasFacade: Boolean(caso.hasFacade || caso.facadeMediaUrl),
        },
        wispro: { ok: true, state: issue.state },
        orden: order,
      });
    }

    if (parsed.data.action === "delete") {
      await deleteCrmWisproCaso(supabase, parsed.data.issueId);
      return NextResponse.json({
        ok: true,
        action: "delete",
        issueId: parsed.data.issueId,
      });
    }

    if (parsed.data.action === "edit") {
      let employeePatch: Partial<UpsertCrmWisproCasoInput> = {};
      if (parsed.data.employeeId !== undefined) {
        if (parsed.data.employeeId && parsed.data.employeeId !== existing.employeeId) {
          const employee = await resolveEmployee(parsed.data.employeeId);
          if (employee) {
            try {
              await reassignHelpDeskIssue({
                issueId: existing.wisproIssueId,
                employeeId: employee.id,
              });
              void upsertCrmTechnicianFromEmployee(supabase, employee).catch((err) => {
                console.warn("[CASOS] technician_upsert_failed", err);
              });
            } catch (reassignError) {
              console.warn("[CASOS] wispro_reassign_failed", reassignError);
            }
            employeePatch = {
              employeeId: employee.id,
              employeeName: employee.name,
              employeePhone: employee.phone_mobile || employee.phone,
              employeeDocument: employee.national_identification_number,
            };
          }
        } else if (!parsed.data.employeeId) {
          employeePatch = {
            employeeId: null,
            employeeName: null,
            employeePhone: null,
            employeeDocument: null,
          };
        }
      }

      const patchData: Partial<UpsertCrmWisproCasoInput> = {
        title: parsed.data.title,
        priority: parsed.data.priority,
        ...employeePatch,
      };
      if (parsed.data.cause !== undefined) patchData.cause = parsed.data.cause;
      if (parsed.data.description !== undefined) patchData.description = parsed.data.description;
      if (parsed.data.addressText !== undefined) patchData.addressText = parsed.data.addressText;
      if (parsed.data.mapsUrl !== undefined) patchData.mapsUrl = parsed.data.mapsUrl;
      if (parsed.data.windowStart !== undefined) patchData.windowStart = parsed.data.windowStart;
      if (parsed.data.windowEnd !== undefined) patchData.windowEnd = parsed.data.windowEnd;
      if (parsed.data.status !== undefined) patchData.status = parsed.data.status;

      const caso = await patchCrmWisproCaso(supabase, existing.wisproIssueId, patchData);
      return NextResponse.json({
        ok: true,
        action: "edit",
        caso: {
          ...caso,
          facadeMediaUrl: null,
          hasFacade: Boolean(caso.hasFacade || caso.facadeMediaUrl),
        },
      });
    }

    if (existing.status === "done" || existing.status === "cancelled") {
      return NextResponse.json(
        { error: "Este ticket ya está cerrado" },
        { status: 409 },
      );
    }

    const employee = await resolveEmployee(parsed.data.employeeId);
    if (!employee) {
      return NextResponse.json(
        { error: "No se encontró el técnico en Wispro" },
        { status: 404 },
      );
    }

    await reassignHelpDeskIssue({
      issueId: existing.wisproIssueId,
      employeeId: employee.id,
    });
    void upsertCrmTechnicianFromEmployee(supabase, employee).catch((error) => {
      console.warn("[CASOS] technician_upsert_failed", error);
    });
    const caso = await patchCrmWisproCaso(supabase, existing.wisproIssueId, {
      employeeId: employee.id,
      employeeName: employee.name,
      employeePhone: employee.phone_mobile || employee.phone,
      employeeDocument: employee.national_identification_number,
    });

    return NextResponse.json({
      ok: true,
      action: "reassign",
      caso: {
        ...caso,
        facadeMediaUrl: null,
        hasFacade: Boolean(caso.hasFacade || caso.facadeMediaUrl),
      },
      wispro: { ok: true },
    });
  } catch (error) {
    if (error instanceof FinalizeCasoError) {
      const status =
        error.code === "not_found"
          ? 404
          : error.code === "already_closed"
            ? 409
            : error.code === "forbidden"
              ? 403
              : 502;
      return NextResponse.json({ error: error.message }, { status });
    }
    const message =
      error instanceof WisproHttpError
        ? error.message
        : error instanceof Error
          ? error.message
          : "No se pudo actualizar el ticket";
    const status = error instanceof WisproHttpError ? error.status : 500;
    return NextResponse.json({ error: message }, { status });
  }
}

export async function DELETE(request: NextRequest) {
  try {
    const issueId = request.nextUrl.searchParams.get("issueId")?.trim();
    if (!issueId) {
      return NextResponse.json({ error: "Falta issueId" }, { status: 400 });
    }
    const supabase = getSupabaseAdmin();
    await deleteCrmWisproCaso(supabase, issueId);
    return NextResponse.json({ ok: true, action: "delete", issueId });
  } catch (error) {
    const message =
      error instanceof Error ? error.message : "No se pudo eliminar el ticket";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
