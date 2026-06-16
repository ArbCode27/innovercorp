import { CRM_COLORS } from "./constants";

export const getInitials = (value: string) => {
  const initials = value
    .trim()
    .split(/\s+/)
    .map((part) => part[0])
    .join("")
    .slice(0, 2)
    .toUpperCase();

  return initials || "??";
};

export const formatCrmTime = (value: string | null) => {
  if (!value) return "";

  return new Intl.DateTimeFormat("es-VE", {
    hour: "2-digit",
    minute: "2-digit",
  }).format(new Date(value));
};

export const formatCrmDate = (value: string | null) => {
  if (!value) return "Sin fecha";

  return new Intl.DateTimeFormat("es-VE", {
    day: "2-digit",
    month: "short",
    hour: "2-digit",
    minute: "2-digit",
  }).format(new Date(value));
};

export const getColorByIndex = (index: number) => CRM_COLORS[index % CRM_COLORS.length];

export const createTicketId = () => {
  const suffix = String(Date.now() % 10000).padStart(4, "0");
  return `TK-${suffix}`;
};
