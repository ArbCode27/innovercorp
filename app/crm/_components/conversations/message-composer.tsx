"use client";

import { KeyboardEvent, useState } from "react";
import { FileText, Paperclip, Send, Tag } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";

interface MessageComposerProps {
  disabled?: boolean;
  onSend: (content: string) => Promise<void>;
  onOpenLabels: () => void;
  onOpenNote: () => void;
}

export const MessageComposer = ({
  disabled,
  onSend,
  onOpenLabels,
  onOpenNote,
}: MessageComposerProps) => {
  const [value, setValue] = useState("");
  const [isSending, setIsSending] = useState(false);

  const handleSendMessage = async () => {
    const content = value.trim();
    if (!content || disabled || isSending) return;

    setIsSending(true);
    try {
      await onSend(content);
      setValue("");
    } catch {
      // The parent component owns user-facing error feedback.
    } finally {
      setIsSending(false);
    }
  };

  const handleKeyDown = (event: KeyboardEvent<HTMLTextAreaElement>) => {
    if (event.key === "Enter" && !event.shiftKey) {
      event.preventDefault();
      handleSendMessage();
    }
  };

  return (
    <div className="shrink-0 border-t border-white/10 bg-[#161922] p-4">
      <div className="mb-2 flex flex-wrap gap-2">
        <Button type="button" variant="outline" size="sm" className="border-white/10 bg-transparent text-xs text-slate-400">
          <Paperclip className="mr-1 size-3" aria-hidden="true" />
          Adjuntar
        </Button>
        <Button type="button" variant="outline" size="sm" onClick={onOpenNote} className="border-white/10 bg-transparent text-xs text-slate-400">
          <FileText className="mr-1 size-3" aria-hidden="true" />
          Nota interna
        </Button>
        <Button type="button" variant="outline" size="sm" onClick={onOpenLabels} className="border-white/10 bg-transparent text-xs text-slate-400">
          <Tag className="mr-1 size-3" aria-hidden="true" />
          Etiqueta
        </Button>
      </div>
      <div className="flex items-end gap-2">
        <Textarea
          value={value}
          onChange={(event) => setValue(event.target.value)}
          onKeyDown={handleKeyDown}
          disabled={disabled || isSending}
          placeholder="Escribe un mensaje..."
          className="min-h-10 max-h-32 resize-none border-white/10 bg-[#1d2130] text-slate-100 placeholder:text-slate-600"
          aria-label="Mensaje"
        />
        <Button
          type="button"
          onClick={handleSendMessage}
          disabled={disabled || isSending}
          className="size-10 rounded-full bg-blue-500 p-0"
          aria-label="Enviar mensaje"
        >
          <Send className="size-4" aria-hidden="true" />
        </Button>
      </div>
    </div>
  );
};
