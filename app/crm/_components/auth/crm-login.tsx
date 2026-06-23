"use client";

import { FormEvent, useEffect, useState } from "react";
import { Layers, Moon, Sun } from "lucide-react";
import { useTheme } from "next-themes";
import { CrmButton } from "../shared/crm-button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { CRM_SURFACES } from "../../_lib/crm-theme";
import { requireText } from "../../_lib/validators";

interface CrmLoginProps {
  isSubmitting: boolean;
  onLogin: (email: string, password: string) => Promise<boolean>;
}

export const CrmLogin = ({ isSubmitting, onLogin }: CrmLoginProps) => {
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState("");
  const { setTheme, resolvedTheme } = useTheme();
  const [mounted, setMounted] = useState(false);

  useEffect(() => {
    setMounted(true);
  }, []);

  const handleSubmit = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    setError("");

    if (!requireText(email) || !requireText(password)) {
      setError("Completa todos los campos");
      return;
    }

    const success = await onLogin(email.trim(), password);
    if (!success) {
      setError("No se pudo iniciar sesión");
    }
  };

  const isDark = mounted && resolvedTheme === "dark";

  return (
    <main className={`relative flex min-h-screen items-center justify-center p-4 ${CRM_SURFACES.page}`}>
      {mounted ? (
        <CrmButton
          type="button"
          variant="ghost"
          size="icon"
          className="absolute right-4 top-4 size-10"
          onClick={() => setTheme(isDark ? "light" : "dark")}
          aria-label={isDark ? "Activar modo claro" : "Activar modo oscuro"}
          title={isDark ? "Modo claro" : "Modo oscuro"}>
          {isDark ? (
            <Sun className="size-5" aria-hidden="true" />
          ) : (
            <Moon className="size-5" aria-hidden="true" />
          )}
        </CrmButton>
      ) : null}

      <form
        onSubmit={handleSubmit}
        className={`w-full max-w-sm rounded-2xl border p-9 shadow-2xl ${CRM_SURFACES.elevated} ${CRM_SURFACES.border}`}>
        <div className="mx-auto mb-5 flex size-12 items-center justify-center rounded-2xl bg-blue-600 text-white">
          <Layers className="size-6" aria-hidden="true" />
        </div>
        <div className="mb-7 text-center">
          <h1 className={`text-xl font-semibold ${CRM_SURFACES.textPrimary}`}>Conexiones Innover</h1>
          <p className={`mt-1 text-sm ${CRM_SURFACES.textMuted}`}>CRM · Acceso de agentes</p>
        </div>

        <div className="space-y-4">
          <div className="space-y-2">
            <Label htmlFor="crm-email" className={`text-xs ${CRM_SURFACES.textMuted}`}>
              Correo electrónico
            </Label>
            <Input
              id="crm-email"
              type="email"
              value={email}
              onChange={(event) => setEmail(event.target.value)}
              placeholder="tu@email.com"
              className={`${CRM_SURFACES.border} ${CRM_SURFACES.input} ${CRM_SURFACES.textPrimary} ${CRM_SURFACES.placeholder}`}
            />
          </div>
          <div className="space-y-2">
            <Label htmlFor="crm-password" className={`text-xs ${CRM_SURFACES.textMuted}`}>
              Contraseña
            </Label>
            <Input
              id="crm-password"
              type="password"
              value={password}
              onChange={(event) => setPassword(event.target.value)}
              placeholder="••••••••"
              className={`${CRM_SURFACES.border} ${CRM_SURFACES.input} ${CRM_SURFACES.textPrimary} ${CRM_SURFACES.placeholder}`}
            />
          </div>
        </div>

        <CrmButton type="submit" disabled={isSubmitting} className="mt-6 w-full">
          {isSubmitting ? "Entrando..." : "Entrar"}
        </CrmButton>
        <p
          className="mt-3 min-h-5 text-center text-xs text-red-600 dark:text-red-200"
          aria-live="polite">
          {error}
        </p>
      </form>
    </main>
  );
};
