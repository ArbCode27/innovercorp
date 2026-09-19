import { describe, expect, it } from "vitest";
import {
  givenNameToken,
  isEmployeeActive,
  isFieldTechnician,
  isLikelyFemaleGivenName,
  selectFieldTechnicians,
} from "./wispro-technician-filter";

const employee = (
  input: Partial<Parameters<typeof isFieldTechnician>[0]> & { id: string; name: string },
) => input;

describe("givenNameToken", () => {
  it("skips particles and hyphens", () => {
    expect(givenNameToken("Ana-María De La Cruz")).toBe("ana");
    expect(givenNameToken("JHONATHAN ABREU")).toBe("jhonathan");
  });
});

describe("isEmployeeActive", () => {
  it("keeps Wispro active staff", () => {
    expect(isEmployeeActive(employee({ id: "1", name: "Jhonathan" }))).toBe(true);
  });

  it("drops blocked or disabled staff", () => {
    expect(isEmployeeActive(employee({ id: "1", name: "Luis", blocked: true }))).toBe(false);
    expect(
      isEmployeeActive(employee({ id: "1", name: "Luis", blockedAt: "2026-01-01" })),
    ).toBe(false);
    expect(isEmployeeActive(employee({ id: "1", name: "Luis", enabled: false }))).toBe(false);
    expect(isEmployeeActive(employee({ id: "1", name: "Luis", status: "Inactivo" }))).toBe(
      false,
    );
  });
});

describe("isFieldTechnician", () => {
  it("keeps active men, including Jhonathan", () => {
    expect(
      isFieldTechnician(employee({ id: "21", name: "JHONATHAN ABREU" })),
    ).toBe(true);
    expect(isLikelyFemaleGivenName("JHONATHAN ABREU")).toBe(false);
  });

  it("excludes women even if they are active", () => {
    expect(isFieldTechnician(employee({ id: "2", name: "María Gabriela Pérez" }))).toBe(
      false,
    );
    expect(
      isFieldTechnician(employee({ id: "3", name: "Luis Pérez", gender: "female" })),
    ).toBe(false);
  });

  it("honors include and exclude overrides", () => {
    expect(
      isFieldTechnician(employee({ id: "ana-1", name: "Ana Técnica" }), {
        includeIds: ["ana-1"],
      }),
    ).toBe(true);
    expect(
      isFieldTechnician(employee({ id: "luis-1", name: "Luis Campo" }), {
        excludeIds: ["luis-1"],
      }),
    ).toBe(false);
  });

  it("never includes inactive staff, even with includeIds", () => {
    expect(
      isFieldTechnician(employee({ id: "21", name: "Jhonathan", blocked: true }), {
        includeIds: ["21"],
      }),
    ).toBe(false);
  });
});

describe("selectFieldTechnicians", () => {
  it("returns only active men, sorted by name", () => {
    const selected = selectFieldTechnicians([
      employee({ id: "2", name: "Zulia Técnico" }),
      employee({ id: "1", name: "Ana Oficina" }),
      employee({ id: "3", name: "Jhonathan Abreu" }),
      employee({ id: "4", name: "Carlos Bloqueado", blocked: true }),
    ]);
    expect(selected.map((item) => item.id)).toEqual(["3", "2"]);
  });
});
