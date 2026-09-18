import type { CrmWisproCaso } from "./wispro-types";

const normalizeName = (value: string | null | undefined) =>
  String(value || "")
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .trim()
    .toLowerCase();

export const matchPendingCasosForTechnician = (
  casos: CrmWisproCaso[],
  input: { publicId?: number | null; clientName?: string | null },
) => {
  if (input.publicId != null) {
    return casos.filter((caso) => caso.wisproPublicId === input.publicId);
  }
  const name = normalizeName(input.clientName);
  if (name.length >= 3) {
    return casos.filter((caso) => normalizeName(caso.clientName).includes(name));
  }
  return casos;
};
