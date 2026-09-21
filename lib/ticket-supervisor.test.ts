import { describe, expect, it } from "vitest";
import {
  isTicketSupervisorId,
  normalizePersonName,
} from "./ticket-supervisor";

describe("normalizePersonName", () => {
  it("strips accents", () => {
    expect(normalizePersonName("Gómez")).toBe("gomez");
  });
});

describe("isTicketSupervisorId", () => {
  it("does not treat field technicians as supervisors without config", () => {
    expect(isTicketSupervisorId("unknown-employee")).toBe(false);
    expect(isTicketSupervisorId(null, 12)).toBe(false);
  });

  it("reads supervisor ids from the env override", () => {
    const previous = process.env.WISPRO_SUPERVISOR_EMPLOYEE_IDS;
    process.env.WISPRO_SUPERVISOR_EMPLOYEE_IDS = "abc-uuid, #42";
    try {
      expect(isTicketSupervisorId("abc-uuid")).toBe(true);
      expect(isTicketSupervisorId(null, 42)).toBe(true);
      expect(isTicketSupervisorId("other-employee")).toBe(false);
    } finally {
      if (previous === undefined) {
        delete process.env.WISPRO_SUPERVISOR_EMPLOYEE_IDS;
      } else {
        process.env.WISPRO_SUPERVISOR_EMPLOYEE_IDS = previous;
      }
    }
  });
});
