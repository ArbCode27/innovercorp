"use client";

import { useEffect, useRef } from "react";
import { MessageCircle } from "lucide-react";
import type { Message } from "../../_lib/types";
import { CRM_SURFACES } from "../../_lib/crm-theme";
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
  const endRef = useRef<HTMLDivElement | null>(null);

  useEffect(() => {
    endRef.current?.scrollIntoView({ behavior: "smooth", block: "end" });
  }, [messages.length]);

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
    <div className="crm-scrollbar flex min-h-0 flex-1 flex-col gap-4 overflow-y-auto bg-[radial-gradient(circle_at_top,_rgba(59,130,246,0.06),_transparent_28rem)] p-5">
      <div className={`flex items-center gap-3 text-[11px] ${CRM_SURFACES.textLabel}`}>
        <span className="h-px flex-1 bg-slate-200 dark:bg-white/10" />
        Conversación
        <span className="h-px flex-1 bg-slate-200 dark:bg-white/10" />
      </div>
      {messages.map((message) => (
        <MessageBubble key={message.id} message={message} agentName={agentName} />
      ))}
      <div ref={endRef} />
    </div>
  );
};
