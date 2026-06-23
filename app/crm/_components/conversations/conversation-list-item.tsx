"use client";

import { Bot, CheckCircle2, Headphones } from "lucide-react";
import { cn } from "@/lib/utils";
import type { Client, Conversation, Label } from "../../_lib/types";
import { formatCrmTime } from "../../_lib/formatters";
import { CRM_BADGE_TONES, CRM_FOCUS_RING, CRM_SURFACES } from "../../_lib/crm-theme";
import { AvatarInitials } from "../shared/avatar-initials";
import { LabelChip } from "../shared/label-chip";
import { StatusBadge } from "../shared/status-badge";

interface ConversationListItemProps {
  conversation: Conversation;
  client: Client | null;
  labels: Label[];
  isActive: boolean;
  onSelect: (id: number) => void;
}

export const ConversationListItem = ({
  conversation,
  client,
  labels,
  isActive,
  onSelect,
}: ConversationListItemProps) => {
  const displayName = client?.name || "Número desconocido";
  const isResolved = conversation.status === "resuelto";
  const isHuman = conversation.human_mode;
  const preview = conversation.preview || "Sin mensajes";

  return (
    <button
      type="button"
      onClick={() => onSelect(conversation.id)}
      className={cn(
        CRM_FOCUS_RING,
        "group w-full border-b p-3 text-left transition",
        CRM_SURFACES.border,
        isActive
          ? "border-l-2 border-l-blue-500 bg-blue-50 dark:bg-blue-950/40"
          : CRM_SURFACES.hover,
      )}>
      <div className="flex gap-3">
        <AvatarInitials
          name={displayName}
          initials={client?.initials}
          color={client?.color || "#f5a524"}
          bg={client?.bg || "rgba(245,165,36,.15)"}
        />
        <div className="min-w-0 flex-1">
          <div className="flex items-start justify-between gap-2">
            <p className={`truncate text-sm font-semibold ${CRM_SURFACES.textPrimary}`}>
              {displayName}
            </p>
            <span className={`shrink-0 text-[11px] ${CRM_SURFACES.textMuted}`}>
              {formatCrmTime(conversation.updated_at)}
            </span>
          </div>
          <div className="mt-1 flex items-center gap-1.5">
            <span
              className={cn(
                "inline-flex items-center gap-1 rounded-full border px-1.5 py-0.5 text-[10px] font-medium",
                isHuman ? CRM_BADGE_TONES.rose : CRM_BADGE_TONES.violet,
              )}>
              {isHuman ? (
                <Headphones className="size-3" aria-hidden="true" />
              ) : (
                <Bot className="size-3" aria-hidden="true" />
              )}
              {isHuman ? "Humano" : "Bot"}
            </span>
            {isResolved ? (
              <span
                className={cn(
                  "inline-flex items-center gap-1 rounded-full border px-1.5 py-0.5 text-[10px] font-medium",
                  CRM_BADGE_TONES.emerald,
                )}>
                <CheckCircle2 className="size-3" aria-hidden="true" />
                Resuelto
              </span>
            ) : (
              <StatusBadge status={conversation.status} />
            )}
          </div>
          <p className={`mt-2 line-clamp-2 text-xs leading-5 ${CRM_SURFACES.textMuted} group-hover:text-slate-600 dark:group-hover:text-slate-300`}>
            {preview}
          </p>
        </div>
        {conversation.unread ? (
          <span className="flex size-5 shrink-0 items-center justify-center rounded-full bg-blue-600 text-[10px] font-semibold text-white">
            {conversation.unread}
          </span>
        ) : null}
      </div>

      {labels.length ? (
        <div className="mt-2 flex flex-wrap gap-1 pl-12">
          {labels.map((label) => (
            <LabelChip key={label.id} label={label} />
          ))}
        </div>
      ) : null}
    </button>
  );
};
