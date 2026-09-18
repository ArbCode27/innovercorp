import { describe, expect, it } from "vitest";
import { pickWisproEmployeeFromCatalog } from "./pick-wispro-employee";
import { documentDigits, documentsMatch } from "./phone-match";
import type { WisproEmployee } from "./wispro-types";

const employee = (
  input: Partial<WisproEmployee> & Pick<WisproEmployee, "id" | "name">,
): WisproEmployee => ({
  public_id: null,
  phone: null,
  phone_mobile: null,
  national_identification_number: null,
  created_at: null,
  updated_at: null,
  ...input,
});

describe("document matching", () => {
  it("compares cédulas by digits only", () => {
    expect(documentDigits("V-17.855.434")).toBe("17855434");
    expect(documentsMatch("V17855434", "17.855.434")).toBe(true);
    expect(documentsMatch("17855434", "12345678")).toBe(false);
  });
});

describe("pickWisproEmployeeFromCatalog", () => {
  const catalog = [
    employee({
      id: "tech-1",
      name: "Ana Tecnica",
      national_identification_number: "V17855434",
      phone_mobile: "+584141112233",
    }),
    employee({
      id: "tech-2",
      name: "Luis Campo",
      phone: "04142223344",
    }),
  ];

  it("prefers the employee cédula over the WhatsApp phone", () => {
    const hit = pickWisproEmployeeFromCatalog(catalog, {
      document: "17855434",
      phone: "04142223344",
    });
    expect(hit?.id).toBe("tech-1");
  });

  it("falls back to the employee phone", () => {
    const hit = pickWisproEmployeeFromCatalog(catalog, {
      phone: "+584142223344",
    });
    expect(hit?.id).toBe("tech-2");
  });
});
