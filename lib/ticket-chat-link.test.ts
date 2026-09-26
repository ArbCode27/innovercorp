import { describe, expect, it } from "vitest";
import {
  conversationHasOpenTicket,
  openCasosForConversation,
  resolveTicketConversationId,
} from "./ticket-chat-link";

const conversations = [
  { id: 11, client_id: 50, customer_phone: "584241500663" },
  { id: 22, client_id: 80, customer_phone: "04121234567" },
];

describe("resolveTicketConversationId", () => {
  it("prefers the ticket conversationId", () => {
    expect(
      resolveTicketConversationId(
        { conversationId: 22, crmClientId: 50, clientPhone: "584241500663" },
        conversations,
      ),
    ).toBe(22);
  });

  it("falls back to crm client id", () => {
    expect(
      resolveTicketConversationId(
        { conversationId: null, crmClientId: 50, clientPhone: null },
        conversations,
      ),
    ).toBe(11);
  });

  it("falls back to matching phone last 10 digits", () => {
    expect(
      resolveTicketConversationId(
        { conversationId: null, crmClientId: null, clientPhone: "+58 424-1500663" },
        conversations,
      ),
    ).toBe(11);
  });

  it("returns null when there is no chat link", () => {
    expect(
      resolveTicketConversationId(
        { conversationId: null, crmClientId: 99, clientPhone: "04129999999" },
        conversations,
      ),
    ).toBeNull();
  });
});

describe("openCasosForConversation", () => {
  const casos = [
    { conversationId: 11, crmClientId: 50, status: "scheduled" },
    { conversationId: 11, crmClientId: 50, status: "done" },
    { conversationId: null, crmClientId: 80, status: "open" },
  ];

  it("returns only open or scheduled casos for that chat", () => {
    expect(openCasosForConversation(conversations[0], casos)).toEqual([
      { conversationId: 11, crmClientId: 50, status: "scheduled" },
    ]);
  });

  it("matches by crm client when conversationId is missing", () => {
    expect(openCasosForConversation(conversations[1], casos)).toEqual([
      { conversationId: null, crmClientId: 80, status: "open" },
    ]);
  });

  it("flags conversations that have an open ticket", () => {
    expect(conversationHasOpenTicket(conversations[0], casos)).toBe(true);
    expect(
      conversationHasOpenTicket({ id: 99, client_id: null, customer_phone: null }, casos),
    ).toBe(false);
  });
});
