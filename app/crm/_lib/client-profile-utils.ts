import type { ClientAccountStatus } from "./types";
import type { CrmBadgeTone } from "./crm-theme";

export const formatClientPlan = (plan: string | null) => {
  if (!plan || plan === "Sin asignar" || plan === "—") {
    return "Sin plan activo";
  }

  return plan;
};

export interface ClientEnvoicingData {
  debt: number;
  hasDebt: boolean;
  calculatedAt?: string;
}

export const parseClientEnvoicing = (
  envoicing: string | null | undefined,
): ClientEnvoicingData | null => {
  if (!envoicing?.trim()) return null;

  try {
    const parsed = JSON.parse(envoicing) as ClientEnvoicingData;

    if (typeof parsed.debt !== "number") return null;

    return {
      debt: parsed.debt,
      hasDebt: Boolean(parsed.hasDebt),
      calculatedAt:
        typeof parsed.calculatedAt === "string" ? parsed.calculatedAt : undefined,
    };
  } catch {
    return null;
  }
};

export const formatClientDebt = (debt: number) =>
  new Intl.NumberFormat("es-VE", {
    style: "currency",
    currency: "USD",
    minimumFractionDigits: 2,
  }).format(debt);

export const getAccountTone = (
  account: ClientAccountStatus | null | undefined,
): CrmBadgeTone => {
  switch (account) {
    case "Al día":
      return "emerald";
    case "Con deuda":
      return "red";
    case "Suspendido":
      return "amber";
    case "Prospecto":
      return "blue";
    default:
      return "neutral";
  }
};

export const getAccountTextClass = (
  account: ClientAccountStatus | null | undefined,
) => {
  switch (account) {
    case "Al día":
      return "text-emerald-700 dark:text-emerald-300";
    case "Con deuda":
      return "text-red-700 dark:text-red-300";
    case "Suspendido":
      return "text-amber-700 dark:text-amber-300";
    case "Prospecto":
      return "text-blue-700 dark:text-blue-300";
    default:
      return "";
  }
};
