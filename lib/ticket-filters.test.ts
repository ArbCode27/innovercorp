import { describe, expect, it } from "vitest";
import { DEFAULT_TICKET_STATUS_FILTER } from "../app/crm/_lib/wispro-caso-schema";
import type { CrmWisproCaso } from "./wispro-types";

const mockCaso = (id: string, status: CrmWisproCaso["status"]): CrmWisproCaso => ({
  id,
  conversationId: 1,
  crmClientId: 1,
  wisproClientId: "cli-1",
  wisproIssueId: `issue-${id}`,
  wisproPublicId: 100,
  wisproOrderId: null,
  employeeId: "emp-1",
  employeeName: "Técnico Prueba",
  employeePhone: "584120000000",
  employeeDocument: "V-12345678",
  status,
  priority: "medium",
  kind: "technical",
  title: `Ticket ${id}`,
  cause: "Sin conexión",
  description: "Detalle del ticket",
  clientName: "Cliente Prueba",
  clientPhone: "584140000000",
  mapsUrl: null,
  latitude: null,
  longitude: null,
  addressText: "Caracas",
  facadeMediaUrl: null,
  facadeMessageId: null,
  windowStart: null,
  windowEnd: null,
  lastTechnicianReportAt: null,
  lastTechnicianReportKey: null,
});

describe("Tickets default status filter", () => {
  it("defaults the status filter to scheduled (agendadas)", () => {
    expect(DEFAULT_TICKET_STATUS_FILTER).toBe("scheduled");
  });

  it("filters unresolved scheduled tickets by default", () => {
    const list: CrmWisproCaso[] = [
      mockCaso("1", "open"),
      mockCaso("2", "scheduled"),
      mockCaso("3", "scheduled"),
      mockCaso("4", "done"),
      mockCaso("5", "cancelled"),
    ];

    const filterStatus = DEFAULT_TICKET_STATUS_FILTER;
    const filtered = list.filter((caso) =>
      filterStatus !== "all" ? caso.status === filterStatus : true,
    );

    expect(filtered).toHaveLength(2);
    expect(filtered.map((c) => c.id)).toEqual(["2", "3"]);
    expect(filtered.every((c) => c.status === "scheduled")).toBe(true);
  });
});
