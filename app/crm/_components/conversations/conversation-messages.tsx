"use client";

import { MessageCircle } from "lucide-react";
import type { Message } from "../../_lib/types";
import { EmptyState } from "../shared/empty-state";
import { LoadingState } from "../shared/loading-state";
import { MessageBubble } from "./message-bubble";

interface ConversationMessagesProps {
  messages: Message[];
  isLoading: boolean;
  agentName: string;
}

export const ConversationMessages = ({
  messages,
  isLoading,
  agentName,
}: ConversationMessagesProps) => {
  if (isLoading) return <LoadingState label="Cargando mensajes..." />;

  if (!messages.length) {
    return (
      <EmptyState
        icon={MessageCircle}
        title="Sin mensajes aún"
        description="Escribe el primer mensaje para iniciar el seguimiento."
      />
    );
  }

  return (
    <div className="flex min-h-0 flex-1 flex-col gap-4 overflow-y-auto p-5">
      <div className="flex items-center gap-3 text-[11px] text-slate-600">
        <span className="h-px flex-1 bg-white/10" />
        Conversación
        <span className="h-px flex-1 bg-white/10" />
      </div>
      {messages.map((message) => (
        <MessageBubble key={message.id} message={message} agentName={agentName} />
      ))}
    </div>
  );
};
