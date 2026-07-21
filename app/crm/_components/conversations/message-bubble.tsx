import { AlertCircle, Bot, Check, CheckCheck, FileText } from "lucide-react";
import { CRM_SURFACES } from "../../_lib/crm-theme";
import type { Message } from "../../_lib/types";
import { formatCrmTime } from "../../_lib/formatters";
import { MessageContent } from "./message-content";

interface MessageBubbleProps {
  message: Message;
}

const statusLabel: Record<string, string> = {
  sent: "Enviado",
  delivered: "Entregado",
  read: "Leído",
  failed: "Falló",
};

export const MessageBubble = ({ message }: MessageBubbleProps) => {
  if (message.type === "note") {
    return (
      <div className="mx-auto flex max-w-[90%] items-center gap-2 rounded-xl border border-amber-400/30 bg-amber-50 px-4 py-2 text-center text-xs italic text-amber-800 dark:border-amber-400/20 dark:bg-amber-400/10 dark:text-amber-300">
        <FileText className="size-4 shrink-0" aria-hidden="true" />
        {message.content}
      </div>
    );
  }

  const isOutgoing = message.type === "out";
  const isBot = isOutgoing && message.sender_type === "bot";
  const isImageMessage =
    message.media_type === "image" && Boolean(message.media_url?.trim());
  const senderLabel = isOutgoing
    ? isBot
      ? message.sent_by?.trim() || "Bot IA"
      : message.sent_by?.trim() || "Agente"
    : "Cliente";
  const status = message.status || "sent";
  const StatusIcon =
    status === "read" ? CheckCheck : status === "failed" ? AlertCircle : Check;

  return (
    <div
      className={`flex max-w-[82%] flex-col gap-1 sm:max-w-[72%] ${
        isOutgoing ? "ml-auto items-end" : "mr-auto items-start"
      }`}>
      <div className={`flex items-center gap-1.5 text-[11px] ${CRM_SURFACES.textMuted}`}>
        <span>{senderLabel}</span>
        {isBot ? (
          <span className="inline-flex items-center gap-1 rounded-full bg-violet-100 px-1.5 py-0.5 text-[10px] text-violet-700 dark:bg-violet-400/10 dark:text-violet-300">
            <Bot className="size-3" aria-hidden="true" />
            IA
          </span>
        ) : null}
      </div>
      {isImageMessage ? (
        <MessageContent message={message} isOutgoing={isOutgoing} />
      ) : (
        <div
          className={`rounded-2xl px-3.5 py-2.5 text-sm leading-relaxed shadow-sm ${
            isOutgoing
              ? "rounded-br-md bg-blue-600 text-white shadow-blue-950/20"
              : `rounded-bl-md border ${CRM_SURFACES.border} ${CRM_SURFACES.card} ${CRM_SURFACES.textPrimary}`
          }`}>
          <MessageContent message={message} isOutgoing={isOutgoing} />
        </div>
      )}
      <span className={`flex items-center gap-1 text-[10px] ${CRM_SURFACES.textLabel}`}>
        {formatCrmTime(message.created_at)}
        {isOutgoing ? (
          <>
            <StatusIcon
              className={`size-3 ${
                status === "read"
                  ? "text-blue-100"
                  : status === "failed"
                    ? "text-red-200"
                    : "text-slate-400 dark:text-slate-500"
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
