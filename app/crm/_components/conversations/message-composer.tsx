"use client";

import { KeyboardEvent, useState } from "react";
import { Send } from "lucide-react";
import { CrmButton } from "../shared/crm-button";
import { Spinner } from "@/components/ui/spinner";
import { Textarea } from "@/components/ui/textarea";
import { cn } from "@/lib/utils";
import { CRM_SURFACES } from "../../_lib/crm-theme";

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
    <div className={`shrink-0 border-t p-4 backdrop-blur ${CRM_SURFACES.border} ${CRM_SURFACES.elevatedTranslucent}`}>
      <div className="flex items-end gap-2">
        <Textarea
          value={value}
          onChange={(event) => setValue(event.target.value)}
          onKeyDown={handleKeyDown}
          readOnly={readOnly}
          disabled={disabled || isSending}
          placeholder={placeholder}
          className={cn(
            "min-h-11 max-h-32 resize-none rounded-2xl focus-visible:ring-blue-400",
            CRM_SURFACES.border,
            readOnly
              ? `${CRM_SURFACES.inputReadonly} ${CRM_SURFACES.textMuted} cursor-not-allowed`
              : CRM_SURFACES.input,
            CRM_SURFACES.textPrimary,
            CRM_SURFACES.placeholder,
          )}
          aria-label="Mensaje"
          aria-readonly={readOnly}
        />
        <CrmButton
          type="button"
          onClick={handleSendMessage}
          disabled={isInputLocked}
          className="size-11 rounded-full p-0"
          aria-label={isSending ? "Enviando mensaje" : "Enviar mensaje"}>
          {isSending ? (
            <Spinner className="size-4 text-white" aria-hidden="true" />
          ) : (
            <Send className="size-4" aria-hidden="true" />
          )}
        </CrmButton>
      </div>
    </div>
  );
};
