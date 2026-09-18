import { documentsMatch, phonesMatch } from "./phone-match";
import type { WisproEmployee } from "./wispro-types";

export const pickWisproEmployeeFromCatalog = (
  employees: WisproEmployee[],
  input: { phone?: string | null; document?: string | null },
): WisproEmployee | null => {
  if (input.document) {
    const byDocument = employees.find((employee) =>
      documentsMatch(input.document, employee.national_identification_number),
    );
    if (byDocument) return byDocument;
  }

  if (!input.phone) return null;
  return (
    employees.find(
      (employee) =>
        phonesMatch(input.phone, employee.phone) ||
        phonesMatch(input.phone, employee.phone_mobile),
    ) || null
  );
};
