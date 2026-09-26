import { phoneLast10 } from "./phone-match";

export type TicketChatLink = {
  conversationId?: number | null;
  crmClientId?: number | null;
  clientPhone?: string | null;
};

export type ConversationChatLink = {
  id: number;
  client_id?: number | null;
  customer_phone?: string | null;
};

export type OpenCasoChatLink = TicketChatLink & {
  status: string;
};

export const isOpenCrmCasoStatus = (status: string | null | undefined) =>
  status === "open" || status === "scheduled";

export const resolveTicketConversationId = (
  ticket: TicketChatLink,
  conversations: ConversationChatLink[],
): number | null => {
  if (ticket.conversationId != null && ticket.conversationId > 0) {
    return ticket.conversationId;
  }

  if (ticket.crmClientId != null) {
    const byClient = conversations.find(
      (conversation) => conversation.client_id === ticket.crmClientId,
    );
    if (byClient) return byClient.id;
  }

  const ticketPhone = phoneLast10(ticket.clientPhone);
  if (!ticketPhone) return null;

  const byPhone = conversations.find(
    (conversation) => phoneLast10(conversation.customer_phone) === ticketPhone,
  );
  return byPhone?.id ?? null;
};

export const openCasosForConversation = <T extends OpenCasoChatLink>(
  conversation: ConversationChatLink,
  casos: T[],
): T[] =>
  casos.filter((caso) => {
    if (!isOpenCrmCasoStatus(caso.status)) return false;
    if (caso.conversationId === conversation.id) return true;
    return Boolean(
      conversation.client_id &&
        caso.crmClientId &&
        caso.crmClientId === conversation.client_id,
    );
  });

export const conversationHasOpenTicket = (
  conversation: ConversationChatLink,
  casos: OpenCasoChatLink[],
) => openCasosForConversation(conversation, casos).length > 0;
