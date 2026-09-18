import type { SupabaseClient } from "@supabase/supabase-js";
import {
  getCrmWisproCasoByIssueId,
  listPendingCasosForEmployee,
  patchCrmWisproCaso,
} from "./crm-wispro-casos";
import { matchPendingCasosForTechnician } from "./match-technician-ticket";
import { closeHelpDeskIssue, closeWorkOrderIfPresent } from "./wispro";

export { matchPendingCasosForTechnician };

export class FinalizeCasoError extends Error {
  readonly code: "not_found" | "already_closed" | "forbidden" | "wispro_failed";

  constructor(
    code: FinalizeCasoError["code"],
    message: string,
  ) {
    super(message);
    this.name = "FinalizeCasoError";
    this.code = code;
  }
}

const isClosed = (status: string) => status === "done" || status === "cancelled";

export const finalizeCrmWisproCaso = async (
  supabase: SupabaseClient,
  input: {
    issueId: string;
    employeeId?: string | null;
  },
) => {
  const existing = await getCrmWisproCasoByIssueId(supabase, input.issueId);
  if (!existing) {
    throw new FinalizeCasoError(
      "not_found",
      "No existe la ficha CRM de este ticket",
    );
  }
  if (isClosed(existing.status)) {
    throw new FinalizeCasoError("already_closed", "Este ticket ya está cerrado");
  }
  if (input.employeeId && existing.employeeId !== input.employeeId) {
    throw new FinalizeCasoError(
      "forbidden",
      "Ese ticket no está asignado a este técnico",
    );
  }

  const issue = await closeHelpDeskIssue(existing.wisproIssueId);
  const order = await closeWorkOrderIfPresent(existing.wisproOrderId);
  const caso = await patchCrmWisproCaso(supabase, existing.wisproIssueId, {
    status: "done",
  });

  return { caso, issue, order };
};

export const listAndMatchTechnicianTicket = async (
  supabase: SupabaseClient,
  employeeId: string,
  input: { publicId?: number | null; clientName?: string | null },
) => {
  const pending = await listPendingCasosForEmployee(supabase, employeeId);
  return {
    pending,
    matches: matchPendingCasosForTechnician(pending, input),
  };
};
