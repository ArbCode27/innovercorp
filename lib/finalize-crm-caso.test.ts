import { describe, expect, it } from "vitest";
import { matchPendingCasosForTechnician } from "./match-technician-ticket";
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

  it("returns all pending tickets when there is no filter", () => {
    expect(matchPendingCasosForTechnician(pending, {})).toHaveLength(2);
  });

  it("does not invent a match for another public id", () => {
    expect(
      matchPendingCasosForTechnician(pending, { publicId: 9999 }),
    ).toEqual([]);
  });
});
