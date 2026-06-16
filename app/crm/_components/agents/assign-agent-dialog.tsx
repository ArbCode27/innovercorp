"use client";

import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import type { Agent, Conversation } from "../../_lib/types";
import { AvatarInitials } from "../shared/avatar-initials";
import { StatusBadge } from "../shared/status-badge";

interface AssignAgentDialogProps {
  open: boolean;
  agents: Agent[];
  conversations: Conversation[];
  onOpenChange: (open: boolean) => void;
  onAssign: (agentId: number) => Promise<void>;
}

export const AssignAgentDialog = ({
  open,
  agents,
  conversations,
  onOpenChange,
  onAssign,
}: AssignAgentDialogProps) => {
  const availableAgents = agents.filter(
    (agent) => agent.status === "online" || agent.status === "busy"
  );

  const handleAssignAgent = async (agentId: number) => {
    await onAssign(agentId);
    onOpenChange(false);
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="border-white/10 bg-[#161922] text-slate-100">
        <DialogHeader>
          <DialogTitle>Asignar conversación</DialogTitle>
          <DialogDescription className="text-slate-500">
            Selecciona el agente que atenderá esta conversación.
          </DialogDescription>
        </DialogHeader>
        <div className="space-y-2">
          {availableAgents.length ? (
            availableAgents.map((agent) => {
              const activeCount = conversations.filter(
                (conversation) =>
                  conversation.agent_id === agent.id &&
                  conversation.status !== "resuelto"
              ).length;

              return (
                <button
                  key={agent.id}
                  type="button"
                  onClick={() => handleAssignAgent(agent.id)}
                  className="flex w-full items-center gap-3 rounded-xl border border-white/10 bg-[#1d2130] p-3 text-left transition hover:border-blue-400/40 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-blue-400"
                >
                  <AvatarInitials
                    name={agent.name}
                    initials={agent.initials}
                    color={agent.avatar_color}
                    bg={agent.avatar_bg}
                  />
                  <div className="min-w-0 flex-1">
                    <p className="truncate text-sm font-medium">{agent.name}</p>
                    <p className="text-xs text-slate-500">
                      {agent.role === "admin" ? "Admin" : "Agente"} · {activeCount} activas de{" "}
                      {agent.max_conversations || 5}
                    </p>
                  </div>
                  <StatusBadge status={agent.status} />
                </button>
              );
            })
          ) : (
            <div className="rounded-xl border border-white/10 bg-[#1d2130] p-4 text-sm text-slate-500">
              No hay agentes disponibles.
            </div>
          )}
        </div>
        <Button type="button" variant="outline" onClick={() => onOpenChange(false)}>
          Cancelar
        </Button>
      </DialogContent>
    </Dialog>
  );
};
