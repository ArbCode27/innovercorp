"use client";

import { useCallback, useState } from "react";
import type { Message } from "../_lib/types";

interface SendMessageInput {
  to: string;
  message: string;
  conversation_id: number;
  agent_id?: number;
}

interface SendMessageResponse {
  success: true;
  wa_message_id: string | null;
  message: Message;
}

export function useSendMessage() {
  const [isSending, setIsSending] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const sendMessage = useCallback(async (input: SendMessageInput) => {
    setIsSending(true);
    setError(null);

    try {
      const res = await fetch("/api/whatsapp/send", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          ...input,
          message: input.message.trim(),
        }),
      });

      const data = await res.json();

      if (!res.ok) {
        throw new Error(data.error || "Error al enviar mensaje");
      }

      return data as SendMessageResponse;
    } catch (error) {
      const message =
        error instanceof Error ? error.message : "Error inesperado al enviar mensaje";

      setError(message);
      throw new Error(message);
    } finally {
      setIsSending(false);
    }
  }, []);

  return { sendMessage, isSending, error };
}
