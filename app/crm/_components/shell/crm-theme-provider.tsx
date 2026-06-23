"use client";

import type { ReactNode } from "react";
import { ThemeProvider } from "@/components/theme-provider";

interface CrmThemeProviderProps {
  children: ReactNode;
}

export const CrmThemeProvider = ({ children }: CrmThemeProviderProps) => (
  <ThemeProvider
    attribute="class"
    defaultTheme="dark"
    enableSystem
    storageKey="crm-theme"
    disableTransitionOnChange>
    {children}
  </ThemeProvider>
);
