import { Bot, FileText } from "lucide-react";
import type { Message } from "../../_lib/types";
import { formatCrmTime } from "../../_lib/formatters";

interface MessageBubbleProps {
  message: Message;
  agentName: string;
}

export const MessageBubble = ({ message, agentName }: MessageBubbleProps) => {
  if (message.type === "note") {
    return (
      <div className="mx-auto flex max-w-[90%] items-center gap-2 rounded-lg border border-amber-400/20 bg-amber-400/10 px-4 py-2 text-center text-xs italic text-amber-300">
        <FileText className="size-4 shrink-0" aria-hidden="true" />
        {message.content}
      </div>
    );
  }

  const isOutgoing = message.type === "out";
  const isBot = isOutgoing && message.sender_type === "bot";

  return (
    <div className={`flex max-w-[72%] flex-col gap-1 ${isOutgoing ? "ml-auto items-end" : "mr-auto"}`}>
      <div className="flex items-center gap-1.5 text-[11px] text-slate-600">
        {isOutgoing ? (isBot ? "Bot IA" : agentName) : "Cliente"}
        {isBot ? (
          <span className="inline-flex items-center gap-1 rounded-full bg-violet-400/10 px-1.5 py-0.5 text-[10px] text-violet-300">
            <Bot className="size-3" aria-hidden="true" />
            Bot IA
          </span>
        ) : null}
      </div>
      <div
        className={`rounded-2xl px-3 py-2 text-sm leading-relaxed ${
          isOutgoing
            ? "rounded-br bg-blue-500 text-white"
            : "rounded-bl border border-white/10 bg-[#1d2130] text-slate-100"
        }`}
      >
        {message.content}
      </div>
      <span className="text-[10px] text-slate-600">{formatCrmTime(message.created_at)}</span>
    </div>
  );
};
