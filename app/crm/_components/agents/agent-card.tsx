"use client";

import { Button } from "@/components/ui/button";
import type { Agent, Conversation } from "../../_lib/types";
import { AvatarInitials } from "../shared/avatar-initials";
import { StatusBadge } from "../shared/status-badge";

interface AgentCardProps {
  agent: Agent;
  currentAgent: Agent;
  conversations: Conversation[];
  onEdit: (agent: Agent) => void;
  onToggleStatus: (agent: Agent) => Promise<void>;
}

export const AgentCard = ({
  agent,
  currentAgent,
  conversations,
  onEdit,
  onToggleStatus,
}: AgentCardProps) => {
  const isAdmin = currentAgent.role === "admin";
  const activeCount = conversations.filter(
    (conversation) =>
      conversation.agent_id === agent.id && conversation.status !== "resuelto"
  ).length;

  return (
    <article className="rounded-xl border border-white/10 bg-[#1d2130] p-4">
      <div className="flex items-start gap-3">
        <AvatarInitials
          name={agent.name}
          initials={agent.initials}
          color={agent.avatar_color}
          bg={agent.avatar_bg}
        />
        <div className="min-w-0 flex-1">
          <div className="flex flex-wrap items-center gap-2">
            <h3 className="truncate text-sm font-semibold text-slate-100">{agent.name}</h3>
            {agent.id === currentAgent.id ? (
              <span className="text-[10px] text-blue-300">(tú)</span>
            ) : null}
          </div>
          <p className="mt-1 truncate text-xs text-slate-500">
            {agent.role === "admin" ? "Administrador" : "Agente básico"} · {agent.email}
          </p>
        </div>
        <StatusBadge status={agent.status} />
      </div>
      <p className="mt-4 text-xs text-slate-400">
        Conversaciones activas:{" "}
        <span className="font-semibold text-slate-100">{activeCount}</span>/
        {agent.max_conversations || 5}
      </p>
      {isAdmin && agent.id !== currentAgent.id ? (
        <div className="mt-4 flex flex-wrap gap-2">
          <Button type="button" variant="outline" size="sm" onClick={() => onEdit(agent)}>
            Editar
          </Button>
          <Button
            type="button"
            variant="outline"
            size="sm"
            onClick={() => onToggleStatus(agent)}
            className="border-red-400/30 text-red-300"
          >
            {agent.status === "inactive" ? "Activar" : "Desactivar"}
          </Button>
        </div>
      ) : null}
    </article>
  );
};
