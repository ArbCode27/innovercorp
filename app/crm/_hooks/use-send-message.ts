export function useSendMessage() {
  const sendMessage = async ({
    to,
    message,
    conversation_id,
    agent_id,
  }: {
    to: string;
    message: string;
    conversation_id: number;
    agent_id?: number;
  }) => {
    const res = await fetch("/api/whatsapp/send", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ to, message, conversation_id, agent_id }),
    });

    if (!res.ok) {
      const error = await res.json();
      throw new Error(error.error || "Error al enviar mensaje");
    }

    return res.json();
  };

  return { sendMessage };
}
