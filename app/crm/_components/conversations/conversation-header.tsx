"use client";

import { Check, FileText, RotateCcw, Tag, UserCheck, UserPlus } from "lucide-react";
import { Button } from "@/components/ui/button";
import type { Agent, Client, Conversation, Label } from "../../_lib/types";
import { AvatarInitials } from "../shared/avatar-initials";
import { LabelChip } from "../shared/label-chip";
import { StatusBadge } from "../shared/status-badge";

interface ConversationHeaderProps {
  conversation: Conversation;
  client: Client | null;
  labels: Label[];
  currentAgent: Agent;
  onOpenLabels: () => void;
  onTakeControl: () => void;
  onReactivateBot: () => void;
  onResolve: () => void;
  onOpenNote: () => void;
  onOpenAssign: () => void;
}

export const ConversationHeader = ({
  conversation,
  client,
  labels,
  currentAgent,
  onOpenLabels,
  onTakeControl,
  onReactivateBot,
  onResolve,
  onOpenNote,
  onOpenAssign,
}: ConversationHeaderProps) => {
  const displayName = client?.name || "Número desconocido";
  const phone = client?.phone || conversation.phone || "Sin identificar";

  return (
    <div className="shrink-0 border-b border-white/10 bg-[#161922]">
      <div className="flex items-start gap-3 p-4">
        <AvatarInitials
          name={displayName}
          initials={client?.initials}
          color={client?.color || "#f5a524"}
          bg={client?.bg || "rgba(245,165,36,.15)"}
          size="lg"
        />
        <div className="min-w-0 flex-1">
          <h2 className="truncate text-sm font-semibold text-slate-100">{displayName}</h2>
          <div className="mt-1 flex flex-wrap items-center gap-2 text-xs text-slate-500">
            <span>{phone}</span>
            <StatusBadge status={conversation.status} />
            <StatusBadge status={conversation.human_mode ? "human" : "bot"} />
          </div>
          {labels.length ? (
            <div className="mt-2 flex flex-wrap gap-1.5">
              {labels.map((label) => (
                <LabelChip key={label.id} label={label} />
              ))}
            </div>
          ) : null}
        </div>
        <div className="flex flex-wrap justify-end gap-2">
          <Button type="button" variant="outline" size="sm" onClick={onOpenLabels} className="border-white/10 bg-transparent text-xs text-slate-300">
            <Tag className="mr-1 size-3" aria-hidden="true" />
            Etiquetas
          </Button>
          {conversation.human_mode ? (
            <Button type="button" variant="outline" size="sm" onClick={onReactivateBot} className="border-white/10 bg-transparent text-xs text-slate-300">
              <RotateCcw className="mr-1 size-3" aria-hidden="true" />
              Reactivar bot
            </Button>
          ) : (
            <Button type="button" variant="outline" size="sm" onClick={onTakeControl} className="border-red-400/30 bg-red-400/10 text-xs text-red-300">
              <UserCheck className="mr-1 size-3" aria-hidden="true" />
              Tomar control
            </Button>
          )}
          {currentAgent.role === "admin" ? (
            <Button type="button" variant="outline" size="sm" onClick={onOpenAssign} className="border-white/10 bg-transparent text-xs text-slate-300">
              <UserPlus className="mr-1 size-3" aria-hidden="true" />
              Asignar
            </Button>
          ) : null}
          {conversation.human_mode ? (
            <Button type="button" variant="outline" size="sm" onClick={onOpenAssign} className="border-white/10 bg-transparent text-xs text-slate-300">
              Transferir
            </Button>
          ) : null}
          {conversation.status !== "resuelto" ? (
            <Button type="button" variant="outline" size="sm" onClick={onResolve} className="border-emerald-400/30 bg-emerald-400/10 text-xs text-emerald-300">
              <Check className="mr-1 size-3" aria-hidden="true" />
              Resolver
            </Button>
          ) : null}
          <Button type="button" variant="outline" size="icon" onClick={onOpenNote} className="size-8 border-white/10 bg-transparent text-slate-300" aria-label="Agregar nota interna">
            <FileText className="size-4" aria-hidden="true" />
          </Button>
        </div>
      </div>
      {conversation.human_mode ? (
        <div className="border-t border-red-400/20 bg-red-400/10 px-4 py-2 text-xs text-red-300">
          Modo agente activo. La IA está pausada.
        </div>
      ) : null}
    </div>
  );
};
