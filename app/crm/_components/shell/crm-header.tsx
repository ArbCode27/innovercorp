"use client";

import { LogOut } from "lucide-react";
import { Button } from "@/components/ui/button";
import type { Agent, CrmView } from "../../_lib/types";
import { StatusBadge } from "../shared/status-badge";

interface CrmHeaderProps {
  activeView: CrmView;
  agent: Agent;
  onLogout: () => void;
}

const titles: Record<CrmView, string> = {
  conversations: "Conversaciones",
  clients: "Clientes",
  tickets: "Tickets",
  labels: "Etiquetas",
  agents: "Agentes",
};

export const CrmHeader = ({ activeView, agent, onLogout }: CrmHeaderProps) => (
  <header className="flex h-16 shrink-0 items-center justify-between border-b border-white/10 bg-[#161922] px-5">
    <div>
      <h1 className="text-base font-semibold text-slate-100">{titles[activeView]}</h1>
      <p className="text-xs text-slate-500">CRM · Conexiones Innover</p>
    </div>
    <div className="flex items-center gap-3">
      <div className="hidden items-center gap-2 text-sm text-slate-400 sm:flex">
        <span>{agent.name}</span>
        <StatusBadge status={agent.status} />
      </div>
      <Button
        type="button"
        variant="ghost"
        size="sm"
        onClick={onLogout}
        className="text-slate-400 hover:bg-white/5 hover:text-slate-100"
      >
        <LogOut className="mr-2 size-4" aria-hidden="true" />
        Salir
      </Button>
    </div>
  </header>
);
