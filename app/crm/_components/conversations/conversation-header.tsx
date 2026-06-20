"use client";

import {
  Check,
  FileText,
  MoreHorizontal,
  RotateCcw,
  Tag,
  UserCheck,
  UserPlus,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
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
    <div className="shrink-0 border-b border-white/10 bg-[#161922]/95 backdrop-blur">
      <div className="flex flex-col gap-3 p-4 xl:flex-row xl:items-start">
        <div className="flex min-w-0 flex-1 gap-3">
          <AvatarInitials
            name={displayName}
            initials={client?.initials}
            color={client?.color || "#f5a524"}
            bg={client?.bg || "rgba(245,165,36,.15)"}
            size="lg"
          />
          <div className="min-w-0 flex-1">
            <h2 className="truncate text-base font-semibold text-slate-100">
              {displayName}
            </h2>
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
        </div>
        <div className="flex shrink-0 flex-wrap items-center justify-end gap-2">
          {conversation.human_mode ? (
            <Button
              type="button"
              variant="outline"
              size="sm"
              onClick={onReactivateBot}
              className="border-violet-400/30 bg-violet-400/10 text-xs text-violet-300 hover:bg-violet-400/15"
            >
              <RotateCcw className="mr-1 size-3" aria-hidden="true" />
              Reactivar bot
            </Button>
          ) : (
            <Button
              type="button"
              variant="outline"
              size="sm"
              onClick={onTakeControl}
              className="border-red-400/30 bg-red-400/10 text-xs text-red-300 hover:bg-red-400/15"
            >
              <UserCheck className="mr-1 size-3" aria-hidden="true" />
              Tomar control
            </Button>
          )}
          {conversation.status !== "resuelto" ? (
            <Button
              type="button"
              variant="outline"
              size="sm"
              onClick={onResolve}
              className="border-emerald-400/30 bg-emerald-400/10 text-xs text-emerald-300 hover:bg-emerald-400/15"
            >
              <Check className="mr-1 size-3" aria-hidden="true" />
              Resolver
            </Button>
          ) : null}
          <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <Button
                type="button"
                variant="outline"
                size="icon"
                className="size-8 border-white/10 bg-transparent text-slate-300 hover:bg-white/5"
                aria-label="Abrir acciones de conversación"
              >
                <MoreHorizontal className="size-4" aria-hidden="true" />
              </Button>
            </DropdownMenuTrigger>
            <DropdownMenuContent
              align="end"
              className="border-white/10 bg-[#161922] text-slate-100"
            >
              <DropdownMenuLabel className="text-xs text-slate-500">
                Acciones
              </DropdownMenuLabel>
              <DropdownMenuItem
                onClick={onOpenLabels}
                className="cursor-pointer focus:bg-white/10"
              >
                <Tag className="size-4" aria-hidden="true" />
                Editar etiquetas
              </DropdownMenuItem>
              <DropdownMenuItem
                onClick={onOpenNote}
                className="cursor-pointer focus:bg-white/10"
              >
                <FileText className="size-4" aria-hidden="true" />
                Agregar nota
              </DropdownMenuItem>
              {currentAgent.role === "admin" || conversation.human_mode ? (
                <>
                  <DropdownMenuSeparator className="bg-white/10" />
                  <DropdownMenuItem
                    onClick={onOpenAssign}
                    className="cursor-pointer focus:bg-white/10"
                  >
                    <UserPlus className="size-4" aria-hidden="true" />
                    {conversation.human_mode
                      ? "Transferir conversación"
                      : "Asignar agente"}
                  </DropdownMenuItem>
                </>
              ) : null}
            </DropdownMenuContent>
          </DropdownMenu>
        </div>
      </div>
      {conversation.human_mode ? (
        <div className="border-t border-red-400/20 bg-red-400/10 px-4 py-2 text-xs text-red-200">
          Modo agente activo: la IA está pausada mientras el equipo responde.
        </div>
      ) : null}
    </div>
  );
};
