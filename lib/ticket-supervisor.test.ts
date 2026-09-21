import { describe, expect, it } from "vitest";
import {
  isTicketSupervisorId,
  isTicketSupervisorPhone,
  matchEmployeesByName,
  normalizePersonName,
} from "./ticket-supervisor";

describe("matchEmployeesByName", () => {
  const employees = [
    { id: "1", name: "Joel Gómez" },
    { id: "2", name: "Alan Pérez" },
    { id: "3", name: "Joel Castillo" },
    { id: "4", name: "Carlos Ruiz" },
  ];

  it("matches a unique given name", () => {
    expect(matchEmployeesByName(employees, "alan").map((item) => item.id)).toEqual(
      ["2"],
    );
  });

  it("returns all homonyms for a shared given name", () => {
    expect(matchEmployeesByName(employees, "joel").map((item) => item.id)).toEqual(
      ["1", "3"],
    );
  });

  it("disambiguates with the last name", () => {
    expect(
      matchEmployeesByName(employees, "joel gomez").map((item) => item.id),
    ).toEqual(["1"]);
  });

  it("ignores short or empty queries", () => {
    expect(matchEmployeesByName(employees, "al")).toEqual([]);
    expect(matchEmployeesByName(employees, "")).toEqual([]);
  });
});

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

describe("isTicketSupervisorPhone", () => {
  it("treats the configured manager WhatsApp as supervisor", () => {
    expect(isTicketSupervisorPhone("04142132785")).toBe(true);
    expect(isTicketSupervisorPhone("+584142132785")).toBe(true);
    expect(isTicketSupervisorPhone("4142132785")).toBe(true);
    expect(isTicketSupervisorPhone("04141234567")).toBe(false);
  });
});
