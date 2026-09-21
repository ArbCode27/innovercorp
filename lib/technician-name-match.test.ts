import { describe, expect, it } from "vitest";
import {
  formatTechnicianNameMatchMessage,
  matchEmployeesByName,
  mergeTechnicianDirectory,
  phoneticKey,
  technicianNameTokens,
  technicianResolvedListHeading,
  type NamedEmployee,
} from "./technician-name-match";

const employees: NamedEmployee[] = [
  { id: "jh", name: "Jhonathan Abreu" },
  { id: "jg", name: "Joel Gómez" },
  { id: "jc", name: "Joel Castillo" },
  { id: "ap", name: "Alan Pérez" },
  { id: "cr", name: "Carlos Ruiz" },
  { id: "lm", name: "Luis Mora" },
];

const resolvedId = (query: string) => {
  const result = matchEmployeesByName(employees, query);
  return result.status === "resolved" ? result.employee.id : result.status;
};

describe("phoneticKey", () => {
  it("maps jonathan variants to jonatan and keeps ch distinct", () => {
    expect(phoneticKey("jonathan")).toBe("jonatan");
    expect(phoneticKey("jhonathan")).toBe("jonatan");
    expect(phoneticKey("allan")).toBe("alan");
    expect(phoneticKey("chavez")).not.toBe(phoneticKey("cavez"));
  });
});

describe("technicianNameTokens", () => {
  it("extracts jonathan from a supervisor sentence", () => {
    expect(
      technicianNameTokens(
        "dame los tickets resueltos de jonathan por favor",
      ),
    ).toEqual(["jonathan"]);
  });
});

describe("matchEmployeesByName", () => {
  it.each([
    "jonathan",
    "jhonatan",
    "yonatan",
    "JONATHAN",
    "Jonatán",
    "abreu",
    "jonathan abreu",
    "abreu jhonathan",
  ])("resolves %s to Jhonathan Abreu", (query) => {
    const result = matchEmployeesByName(employees, query);
    expect(result.status).toBe("resolved");
    if (result.status === "resolved") {
      expect(result.employee.id).toBe("jh");
      expect(result.employee.name).toBe("Jhonathan Abreu");
      expect(result.score).toBeGreaterThanOrEqual(0.7);
    }
  });

  it("treats joel as ambiguous between Gómez and Castillo", () => {
    const result = matchEmployeesByName(employees, "joel");
    expect(result.status).toBe("ambiguous");
    if (result.status === "ambiguous") {
      expect(result.candidates.map((item) => item.employee.id).sort()).toEqual([
        "jc",
        "jg",
      ]);
    }
    expect(formatTechnicianNameMatchMessage("joel", result)).toMatch(
      /^Hay varios: Joel (Gómez|Castillo), Joel (Gómez|Castillo)\. ¿Cuál\?$/,
    );
  });

  it("resolves joel castillo to Castillo", () => {
    expect(resolvedId("joel castillo")).toBe("jc");
  });

  it("does not cross joel with alan or jose with joel", () => {
    expect(resolvedId("joel")).toBe("ambiguous");
    const alan = matchEmployeesByName(employees, "alan");
    expect(alan.status).toBe("resolved");
    if (alan.status === "resolved") expect(alan.employee.id).toBe("ap");

    const jose = matchEmployeesByName(employees, "jose");
    expect(jose.status).toBe("not_found");
  });

  it("equates alan and allan", () => {
    expect(resolvedId("alan")).toBe("ap");
    expect(resolvedId("allan")).toBe("ap");
  });

  it("does not treat the same employee_id from two sources as ambiguous", () => {
    const result = matchEmployeesByName(
      [
        { id: "jh", name: "Jhonathan Abreu" },
        { id: "jh", name: "Jonathan Abreu" },
      ],
      "jonathan",
    );
    expect(result.status).toBe("resolved");
    if (result.status === "resolved") expect(result.employee.id).toBe("jh");
  });

  it("returns not_found with suggestions for an unknown name", () => {
    const result = matchEmployeesByName(employees, "ximenazzz");
    expect(result.status).toBe("not_found");
    if (result.status === "not_found") {
      expect(result.suggestions.length).toBeGreaterThan(0);
      expect(result.suggestions.length).toBeLessThanOrEqual(3);
    }
    expect(formatTechnicianNameMatchMessage("ximenazzz", result)).toMatch(
      /^No encontré «ximenazzz»\. ¿Quisiste decir: /,
    );
  });

  it("keeps only jonathan after stripping filler words", () => {
    const result = matchEmployeesByName(
      employees,
      "dame los tickets resueltos de jonathan por favor",
    );
    expect(result.status).toBe("resolved");
    if (result.status === "resolved") expect(result.employee.id).toBe("jh");
  });

  it("uses an official-name heading when the match is not exact", () => {
    const result = matchEmployeesByName(employees, "jonathan");
    expect(result.status).toBe("resolved");
    if (result.status === "resolved") {
      expect(result.matchedBy).not.toBe("exact");
      expect(technicianResolvedListHeading(result.employee.name, result.matchedBy)).toBe(
        "Tickets de Jhonathan Abreu",
      );
    }
  });
});

describe("mergeTechnicianDirectory", () => {
  it("deduplicates by employee_id and keeps the first official name", () => {
    const merged = mergeTechnicianDirectory([
      [{ id: "jh", name: "Jhonathan Abreu" }],
      [{ id: "jh", name: "Jonathan Abreu" }, { id: "ap", name: "Alan Pérez" }],
      [{ id: "jh", name: "Jhonathan" }],
    ]);
    expect(merged).toEqual([
      { id: "jh", name: "Jhonathan Abreu", publicId: null },
      { id: "ap", name: "Alan Pérez", publicId: null },
    ]);
    expect(matchEmployeesByName(merged, "jonathan").status).toBe("resolved");
  });
});
