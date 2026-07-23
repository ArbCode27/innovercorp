import { useState } from "react";
import { AlertCircle, Bot, Check, CheckCheck, FileText, HandCoins } from "lucide-react";
import { toast } from "sonner";
import { CRM_SURFACES } from "../../_lib/crm-theme";
import type { Message } from "../../_lib/types";
import { formatCrmTime } from "../../_lib/formatters";
import { MessageContent } from "./message-content";
import { CrmButton } from "../shared/crm-button";

interface MessageBubbleProps {
  message: Message;
  onProcessPaymentReceipt?: (messageId: number) => Promise<void>;
}

const statusLabel: Record<string, string> = {
  sent: "Enviado",
  delivered: "Entregado",
  read: "Leído",
  failed: "Falló",
};

const hasRequestedPaymentReceipt = (message: Message) => {
  const value = message.metadata?.payment_receipt_requested;
  if (typeof value === "boolean") return value;
  if (typeof value === "string") return value.toLowerCase() === "true";
  return false;
};

export const MessageBubble = ({ message, onProcessPaymentReceipt }: MessageBubbleProps) => {
  const [isProcessingPaymentReceipt, setIsProcessingPaymentReceipt] = useState(false);
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
  const canProcessPaymentReceipt =
    Boolean(onProcessPaymentReceipt) && !isOutgoing && isImageMessage;
  const paymentReceiptRequested = hasRequestedPaymentReceipt(message);
  const isLocationMessage = message.media_type === "location";
  const senderLabel = isOutgoing
    ? isBot
      ? message.sent_by?.trim() || "Bot IA"
      : message.sent_by?.trim() || "Agente"
    : "Cliente";
  const status = message.status || "sent";
  const StatusIcon =
    status === "read" ? CheckCheck : status === "failed" ? AlertCircle : Check;
  const handleProcessPaymentReceipt = async () => {
    if (!onProcessPaymentReceipt) return;

    setIsProcessingPaymentReceipt(true);
    try {
      await onProcessPaymentReceipt(message.id);
      toast.success("Comprobante enviado a procesamiento");
    } catch (error) {
      toast.error(
        error instanceof Error
          ? error.message
          : "No se pudo procesar el comprobante",
      );
    } finally {
      setIsProcessingPaymentReceipt(false);
    }
  };

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
      {isImageMessage || isLocationMessage ? (
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
      {canProcessPaymentReceipt ? (
        <CrmButton
          type="button"
          size="sm"
          variant="secondary"
          disabled={isProcessingPaymentReceipt || paymentReceiptRequested}
          onClick={handleProcessPaymentReceipt}
          className="mt-1 h-7 px-2.5 text-[11px]">
          <HandCoins className="size-3" aria-hidden="true" />
          {paymentReceiptRequested
            ? "Comprobante enviado"
            : isProcessingPaymentReceipt
              ? "Procesando..."
              : "Registrar pago"}
        </CrmButton>
      ) : null}
    </div>
  );
};
