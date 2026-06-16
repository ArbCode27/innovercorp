import type { Metadata } from "next";
import type { ReactNode } from "react";

export const metadata: Metadata = {
  title: "CRM · Conexiones Innover",
  description: "Módulo CRM independiente para gestión de conversaciones.",
};

export default function CrmLayout({ children }: { children: ReactNode }) {
  return children;
}
