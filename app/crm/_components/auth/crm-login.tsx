"use client";

import { FormEvent, useState } from "react";
import { Layers } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { requireText } from "../../_lib/validators";

interface CrmLoginProps {
  isSubmitting: boolean;
  onLogin: (email: string, password: string) => Promise<boolean>;
}

export const CrmLogin = ({ isSubmitting, onLogin }: CrmLoginProps) => {
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState("");

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

  return (
    <main className="flex min-h-screen items-center justify-center bg-[#0f1117] p-4 text-slate-100">
      <form
        onSubmit={handleSubmit}
        className="w-full max-w-sm rounded-2xl border border-white/10 bg-[#161922] p-9 shadow-2xl"
      >
        <div className="mx-auto mb-5 flex size-12 items-center justify-center rounded-2xl bg-blue-500 text-white">
          <Layers className="size-6" aria-hidden="true" />
        </div>
        <div className="mb-7 text-center">
          <h1 className="text-xl font-semibold">Conexiones Innover</h1>
          <p className="mt-1 text-sm text-slate-500">CRM · Acceso de agentes</p>
        </div>

        <div className="space-y-4">
          <div className="space-y-2">
            <Label htmlFor="crm-email" className="text-xs text-slate-400">
              Correo electrónico
            </Label>
            <Input
              id="crm-email"
              type="email"
              value={email}
              onChange={(event) => setEmail(event.target.value)}
              placeholder="tu@email.com"
              className="border-white/10 bg-[#1d2130] text-slate-100 placeholder:text-slate-600"
            />
          </div>
          <div className="space-y-2">
            <Label htmlFor="crm-password" className="text-xs text-slate-400">
              Contraseña
            </Label>
            <Input
              id="crm-password"
              type="password"
              value={password}
              onChange={(event) => setPassword(event.target.value)}
              placeholder="••••••••"
              className="border-white/10 bg-[#1d2130] text-slate-100 placeholder:text-slate-600"
            />
          </div>
        </div>

        <Button type="submit" disabled={isSubmitting} className="mt-6 w-full bg-blue-500">
          {isSubmitting ? "Entrando..." : "Entrar"}
        </Button>
        <p className="mt-3 min-h-5 text-center text-xs text-red-300" aria-live="polite">
          {error}
        </p>
      </form>
    </main>
  );
};
