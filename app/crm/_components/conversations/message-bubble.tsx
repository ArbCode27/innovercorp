import { AlertCircle, Bot, Check, CheckCheck, FileText } from "lucide-react";
import type { Message } from "../../_lib/types";
import { formatCrmTime } from "../../_lib/formatters";

interface MessageBubbleProps {
  message: Message;
  agentName: string;
}

const statusLabel: Record<string, string> = {
  sent: "Enviado",
  delivered: "Entregado",
  read: "Leído",
  failed: "Falló",
};

export const MessageBubble = ({ message, agentName }: MessageBubbleProps) => {
  if (message.type === "note") {
    return (
      <div className="mx-auto flex max-w-[90%] items-center gap-2 rounded-xl border border-amber-400/20 bg-amber-400/10 px-4 py-2 text-center text-xs italic text-amber-300">
        <FileText className="size-4 shrink-0" aria-hidden="true" />
        {message.content}
      </div>
    );
  }

  const isOutgoing = message.type === "out";
  const isBot = isOutgoing && message.sender_type === "bot";
  const senderLabel = isOutgoing ? (isBot ? "Bot IA" : agentName) : "Cliente";
  const status = message.status || "sent";
  const StatusIcon =
    status === "read" ? CheckCheck : status === "failed" ? AlertCircle : Check;

  return (
    <div
      className={`flex max-w-[82%] flex-col gap-1 sm:max-w-[72%] ${
        isOutgoing ? "ml-auto items-end" : "mr-auto items-start"
      }`}
    >
      <div className="flex items-center gap-1.5 text-[11px] text-slate-500">
        <span>{senderLabel}</span>
        {isBot ? (
          <span className="inline-flex items-center gap-1 rounded-full bg-violet-400/10 px-1.5 py-0.5 text-[10px] text-violet-300">
            <Bot className="size-3" aria-hidden="true" />
            IA
          </span>
        ) : null}
      </div>
      <div
        className={`rounded-2xl px-3.5 py-2.5 text-sm leading-relaxed shadow-sm ${
          isOutgoing
            ? "rounded-br-md bg-blue-500 text-white shadow-blue-950/20"
            : "rounded-bl-md border border-white/10 bg-[#1d2130] text-slate-100"
        }`}
      >
        {message.content}
      </div>
      <span className="flex items-center gap-1 text-[10px] text-slate-600">
        {formatCrmTime(message.created_at)}
        {isOutgoing ? (
          <>
            <StatusIcon
              className={`size-3 ${
                status === "read"
                  ? "text-blue-300"
                  : status === "failed"
                    ? "text-red-300"
                    : "text-slate-500"
              }`}
              aria-hidden="true"
            />
            <span className="sr-only">{statusLabel[status] || status}</span>
          </>
        ) : null}
      </span>
    </div>
  );
};
