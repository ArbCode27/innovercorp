"use client";

import type { Client, Conversation, Label } from "../../_lib/types";
import { formatCrmTime } from "../../_lib/formatters";
import { AvatarInitials } from "../shared/avatar-initials";
import { LabelChip } from "../shared/label-chip";

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

  return (
    <button
      type="button"
      onClick={() => onSelect(conversation.id)}
      className={`w-full border-b border-white/10 p-3 text-left transition focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-blue-400 ${
        isActive ? "border-l-2 border-l-blue-400 bg-blue-400/10" : "hover:bg-white/[.03]"
      }`}
    >
      <div className="flex gap-3">
        <AvatarInitials
          name={displayName}
          initials={client?.initials}
          color={client?.color || "#f5a524"}
          bg={client?.bg || "rgba(245,165,36,.15)"}
        />
        <div className="min-w-0 flex-1">
          <div className="flex items-start justify-between gap-2">
            <p className="truncate text-sm font-medium text-slate-100">{displayName}</p>
            <span className="shrink-0 text-[11px] text-slate-600">
              {formatCrmTime(conversation.updated_at)}
            </span>
          </div>
          <p className="mt-1 truncate text-xs text-slate-400">
            {conversation.preview || "Sin mensajes"}
          </p>
        </div>
        {conversation.unread ? (
          <span className="flex size-5 shrink-0 items-center justify-center rounded-full bg-blue-500 text-[10px] font-semibold text-white">
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
