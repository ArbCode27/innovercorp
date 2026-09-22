import { describe, expect, it, vi } from "vitest";
import {
  finalizeCrmWisproCaso,
  FinalizeCasoError,
} from "./finalize-crm-caso";
import {
  matchPendingCasosForTechnician,
  matchTechnicianTicketDetail,
} from "./match-technician-ticket";
import type { SupabaseClient } from "@supabase/supabase-js";
import type { CrmWisproCaso } from "./wispro-types";

const caso = (
  input: Pick<CrmWisproCaso, "wisproIssueId" | "wisproPublicId" | "clientName">,
): CrmWisproCaso => ({
  id: input.wisproIssueId,
  conversationId: null,
  crmClientId: null,
  wisproClientId: null,
  wisproIssueId: input.wisproIssueId,
  wisproPublicId: input.wisproPublicId,
  wisproOrderId: null,
  employeeId: "tech-1",
  employeeName: "José Pérez",
  employeePhone: null,
  employeeDocument: null,
  status: "scheduled",
  priority: "medium",
  kind: "technical",
  title: "Visita técnica",
  cause: "Sin internet",
  description: null,
  clientName: input.clientName,
  clientPhone: null,
  mapsUrl: null,
  latitude: null,
  longitude: null,
  addressText: null,
  facadeMediaUrl: null,
  facadeMessageId: null,
  windowStart: null,
  windowEnd: null,
  lastTechnicianReportAt: null,
  lastTechnicianReportKey: null,
  createdAt: null,
  updatedAt: null,
});

describe("matchPendingCasosForTechnician", () => {
  const pending = [
    caso({
      wisproIssueId: "a",
      wisproPublicId: 1842,
      clientName: "María López",
    }),
    caso({
      wisproIssueId: "b",
      wisproPublicId: 1901,
      clientName: "Carlos Ruiz",
    }),
    caso({
      wisproIssueId: "c",
      wisproPublicId: 1843,
      clientName: "SANDRA KEY SERRANO",
    }),
  ];

  it("matches a unique public id", () => {
    expect(
      matchPendingCasosForTechnician(pending, { publicId: 1842 }).map(
        (item) => item.wisproIssueId,
      ),
    ).toEqual(["a"]);
  });

  it("matches client name without accents", () => {
    expect(
      matchPendingCasosForTechnician(pending, { clientName: "maria" }).map(
        (item) => item.wisproIssueId,
      ),
    ).toEqual(["a"]);
  });

  it("matches a partial client name from a technician message", () => {
    expect(
      matchPendingCasosForTechnician(pending, { clientName: "Sandra key" }).map(
        (item) => item.wisproIssueId,
      ),
    ).toEqual(["c"]);
  });

  it("matches informal phrasing against the known client name", () => {
    expect(
      matchPendingCasosForTechnician(pending, {
        clientName: "esa de sandra",
      }).map((item) => item.wisproIssueId),
    ).toEqual(["c"]);
  });

  it("closes the only pending ticket when the name is informal and unique", () => {
    const onlySandra = pending.filter((item) => item.wisproIssueId === "c");
    expect(
      matchPendingCasosForTechnician(onlySandra, { clientName: "ya esa" }).map(
        (item) => item.wisproIssueId,
      ),
    ).toEqual(["c"]);
  });

  it("returns all pending tickets when there is no filter", () => {
    expect(matchPendingCasosForTechnician(pending, {})).toHaveLength(3);
  });

  it("does not invent a match for another public id", () => {
    expect(
      matchPendingCasosForTechnician(pending, { publicId: 9999 }),
    ).toEqual([]);
  });
});

describe("matchTechnicianTicketDetail", () => {
  const pending = [
    caso({
      wisproIssueId: "a",
      wisproPublicId: 1842,
      clientName: "Tania Ortiz",
    }),
    caso({
      wisproIssueId: "b",
      wisproPublicId: 1901,
      clientName: "Pedro Guzmán",
    }),
    caso({
      wisproIssueId: "c",
      wisproPublicId: 1843,
      clientName: "Katiuska Ramirez",
    }),
  ];

  it("resolves a 1-based list index", () => {
    expect(
      matchTechnicianTicketDetail(pending, { listIndex: 2 }).map(
        (item) => item.wisproIssueId,
      ),
    ).toEqual(["b"]);
  });

  it("returns empty for an out-of-range index", () => {
    expect(matchTechnicianTicketDetail(pending, { listIndex: 9 })).toEqual([]);
  });

  it("does not dump the queue when there is no filter", () => {
    expect(matchTechnicianTicketDetail(pending, {})).toEqual([]);
  });

  it("sends the only pending ticket when the tech asks for detail with no name", () => {
    expect(
      matchTechnicianTicketDetail([pending[0]], {}).map(
        (item) => item.wisproIssueId,
      ),
    ).toEqual(["a"]);
  });

  it("matches a client name fragment", () => {
    expect(
      matchTechnicianTicketDetail(pending, { clientName: "tania" }).map(
        (item) => item.wisproIssueId,
      ),
    ).toEqual(["a"]);
  });
});

describe("finalizeCrmWisproCaso", () => {
  it("throws not_found if the ticket does not exist in CRM", async () => {
    const mockSupabase = {
      from: vi.fn().mockReturnValue({
        select: vi.fn().mockReturnValue({
          eq: vi.fn().mockReturnValue({
            maybeSingle: vi.fn().mockResolvedValue({ data: null, error: null }),
          }),
        }),
      }),
    } as unknown as SupabaseClient;

    await expect(
      finalizeCrmWisproCaso(mockSupabase, { issueId: "missing-issue" }),
    ).rejects.toMatchObject({ code: "not_found" });
  });

  it("throws already_closed if ticket is already done", async () => {
    const mockSupabase = {
      from: vi.fn().mockReturnValue({
        select: vi.fn().mockReturnValue({
          eq: vi.fn().mockReturnValue({
            maybeSingle: vi.fn().mockResolvedValue({
              data: {
                id: "case-1",
                wispro_issue_id: "issue-1",
                status: "done",
              },
              error: null,
            }),
          }),
        }),
      }),
    } as unknown as SupabaseClient;

    await expect(
      finalizeCrmWisproCaso(mockSupabase, { issueId: "issue-1" }),
    ).rejects.toMatchObject({ code: "already_closed" });
  });

  it("throws forbidden if ticket is assigned to another technician", async () => {
    const mockSupabase = {
      from: vi.fn().mockReturnValue({
        select: vi.fn().mockReturnValue({
          eq: vi.fn().mockReturnValue({
            maybeSingle: vi.fn().mockResolvedValue({
              data: {
                id: "case-1",
                wispro_issue_id: "issue-1",
                employee_id: "tech-1",
                status: "scheduled",
              },
              error: null,
            }),
          }),
        }),
      }),
    } as unknown as SupabaseClient;

    await expect(
      finalizeCrmWisproCaso(mockSupabase, {
        issueId: "issue-1",
        employeeId: "tech-2",
      }),
    ).rejects.toMatchObject({ code: "forbidden" });
  });
});
