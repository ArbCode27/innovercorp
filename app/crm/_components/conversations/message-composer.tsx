"use client";

import { KeyboardEvent, useState } from "react";
import { Mic, Send, Square, Trash2 } from "lucide-react";
import { CrmButton } from "../shared/crm-button";
import { Spinner } from "@/components/ui/spinner";
import { Textarea } from "@/components/ui/textarea";
import { cn } from "@/lib/utils";
import { CRM_SURFACES } from "../../_lib/crm-theme";
import { useVoiceRecorder } from "../../_hooks/use-voice-recorder";

interface MessageComposerProps {
  disabled?: boolean;
  readOnly?: boolean;
  placeholder?: string;
  onSend: (content: string) => Promise<void>;
  onSendVoiceNote: (
    audioBlob: Blob,
    meta: { durationMs: number; mimeType: string },
  ) => Promise<void>;
}

const formatDuration = (durationMs: number) => {
  const totalSeconds = Math.max(0, Math.floor(durationMs / 1000));
  const minutes = Math.floor(totalSeconds / 60);
  const seconds = String(totalSeconds % 60).padStart(2, "0");
  return `${minutes}:${seconds}`;
};

export const MessageComposer = ({
  disabled,
  readOnly = false,
  placeholder = "Escribe un mensaje...",
  onSend,
  onSendVoiceNote,
}: MessageComposerProps) => {
  const [value, setValue] = useState("");
  const [isSending, setIsSending] = useState(false);
  const [isSendingVoice, setIsSendingVoice] = useState(false);
  const recorder = useVoiceRecorder();
  const isBusy = isSending || isSendingVoice;
  const isInputLocked = disabled || isBusy || readOnly;
  const canStartRecording =
    !isInputLocked && recorder.supportsRecording && recorder.status !== "recording";

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

  const handleStartRecording = async () => {
    if (!canStartRecording) return;
    await recorder.startRecording();
  };

  const handleSendVoiceNote = async () => {
    if (
      isInputLocked ||
      !recorder.audioBlob ||
      recorder.status !== "recorded"
    ) {
      return;
    }

    setIsSendingVoice(true);
    try {
      await onSendVoiceNote(recorder.audioBlob, {
        durationMs: recorder.durationMs,
        mimeType: recorder.audioBlob.type || recorder.selectedMimeType || "audio/webm",
      });
      recorder.discardRecording();
    } catch {
      // The parent component owns user-facing error feedback.
    } finally {
      setIsSendingVoice(false);
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
      {recorder.status === "recording" ? (
        <div
          className={`mb-3 rounded-xl border px-3 py-2 ${CRM_SURFACES.border} ${CRM_SURFACES.input}`}
          role="status"
          aria-live="polite">
          <div className="flex items-center justify-between gap-3">
            <p className={`text-sm font-medium ${CRM_SURFACES.textPrimary}`}>
              Grabando nota de voz... {formatDuration(recorder.durationMs)}
            </p>
            <div className="flex items-center gap-2">
              <CrmButton
                type="button"
                variant="secondary"
                className="h-8 px-3"
                onClick={recorder.discardRecording}
                disabled={isInputLocked}
                aria-label="Cancelar grabación">
                Cancelar
              </CrmButton>
              <CrmButton
                type="button"
                variant="destructive"
                className="h-8 px-3"
                onClick={recorder.stopRecording}
                disabled={isInputLocked}
                aria-label="Detener grabación">
                <Square className="size-3.5" aria-hidden="true" />
                Detener
              </CrmButton>
            </div>
          </div>
        </div>
      ) : null}

      {recorder.status === "recorded" && recorder.audioUrl ? (
        <div className={`mb-3 rounded-xl border p-3 ${CRM_SURFACES.border} ${CRM_SURFACES.input}`}>
          <div className="mb-2 flex items-center justify-between gap-2">
            <p className={`text-sm font-medium ${CRM_SURFACES.textPrimary}`}>
              Nota lista ({formatDuration(recorder.durationMs)})
            </p>
            <div className="flex items-center gap-2">
              <CrmButton
                type="button"
                variant="secondary"
                className="h-8 px-3"
                onClick={recorder.discardRecording}
                disabled={isBusy}
                aria-label="Descartar nota de voz">
                <Trash2 className="size-3.5" aria-hidden="true" />
                Descartar
              </CrmButton>
              <CrmButton
                type="button"
                className="h-8 px-3"
                onClick={handleSendVoiceNote}
                disabled={isBusy}
                aria-label={isSendingVoice ? "Enviando nota de voz" : "Enviar nota de voz"}>
                {isSendingVoice ? (
                  <Spinner className="size-4 text-white" aria-hidden="true" />
                ) : (
                  <Send className="size-4" aria-hidden="true" />
                )}
                Enviar audio
              </CrmButton>
            </div>
          </div>
          <audio
            src={recorder.audioUrl}
            controls
            preload="metadata"
            className="w-full"
            aria-label="Vista previa de nota de voz"
          />
        </div>
      ) : null}

      {recorder.error && recorder.status !== "unsupported" ? (
        <p className="mb-2 text-xs text-rose-500" role="alert">
          {recorder.error}
        </p>
      ) : null}

      <div className="flex items-end gap-2">
        <CrmButton
          type="button"
          variant="secondary"
          onClick={handleStartRecording}
          disabled={!canStartRecording}
          className="size-11 rounded-full p-0"
          aria-label="Grabar nota de voz">
          <Mic className="size-4" aria-hidden="true" />
        </CrmButton>
        <Textarea
          value={value}
          onChange={(event) => setValue(event.target.value)}
          onKeyDown={handleKeyDown}
          readOnly={readOnly}
          disabled={disabled || isBusy || recorder.status === "recording"}
          placeholder={placeholder}
          className={cn(
            "min-h-11 max-h-28 resize-none rounded-2xl focus-visible:ring-blue-400 md:max-h-32",
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
      {!recorder.supportsRecording ? (
        <p className={`mt-2 text-xs ${CRM_SURFACES.textMuted}`}>
          Tu navegador no soporta grabación de notas de voz.
        </p>
      ) : null}
    </div>
  );
};
