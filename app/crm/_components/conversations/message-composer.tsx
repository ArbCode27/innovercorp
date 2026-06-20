"use client";

import { KeyboardEvent, useState } from "react";
import { Send } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Spinner } from "@/components/ui/spinner";
import { Textarea } from "@/components/ui/textarea";

interface MessageComposerProps {
  disabled?: boolean;
  readOnly?: boolean;
  placeholder?: string;
  onSend: (content: string) => Promise<void>;
}

export const MessageComposer = ({
  disabled,
  readOnly = false,
  placeholder = "Escribe un mensaje...",
  onSend,
}: MessageComposerProps) => {
  const [value, setValue] = useState("");
  const [isSending, setIsSending] = useState(false);
  const isInputLocked = disabled || isSending || readOnly;

  const handleSendMessage = async () => {
    const content = value.trim();
    if (!content || isInputLocked) return;

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
    if (readOnly) return;

    if (event.key === "Enter" && !event.shiftKey) {
      event.preventDefault();
      handleSendMessage();
    }
  };

  return (
    <div className="shrink-0 border-t border-white/10 bg-[#161922]/95 p-4 backdrop-blur">
      <div className="flex items-end gap-2">
        <Textarea
          value={value}
          onChange={(event) => setValue(event.target.value)}
          onKeyDown={handleKeyDown}
          readOnly={readOnly}
          disabled={disabled || isSending}
          placeholder={placeholder}
          className={`min-h-11 max-h-32 resize-none rounded-2xl border-white/10 text-slate-100 placeholder:text-slate-600 focus-visible:ring-blue-400 ${
            readOnly
              ? "cursor-not-allowed bg-[#181b24] text-slate-500"
              : "bg-[#1d2130]"
          }`}
          aria-label="Mensaje"
          aria-readonly={readOnly}
        />
        <Button
          type="button"
          onClick={handleSendMessage}
          disabled={isInputLocked}
          className="size-11 rounded-full bg-blue-500 p-0 hover:bg-blue-400 disabled:bg-blue-500/50"
          aria-label={isSending ? "Enviando mensaje" : "Enviar mensaje"}
        >
          {isSending ? (
            <Spinner className="size-4 text-white" aria-hidden="true" />
          ) : (
            <Send className="size-4" aria-hidden="true" />
          )}
        </Button>
      </div>
    </div>
  );
};
