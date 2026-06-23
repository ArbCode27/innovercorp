export type AgentRole = "admin" | "agent";

export type AgentStatus = "online" | "busy" | "offline" | "inactive";

export type ClientAccountStatus =
  | "Al día"
  | "Con deuda"
  | "Suspendido"
  | "Prospecto";

export type ConversationStatus = "abierto" | "proceso" | "resuelto";

export type MessageType = "in" | "out" | "note";

export type MessageSenderType = "client" | "agent" | "bot";

export type MessageMediaType = "audio" | "image" | "video" | "document";

export type TicketStatus = "Abierto" | "En proceso" | "Resuelto";

export type CrmView = "conversations" | "clients" | "tickets" | "labels" | "agents";

export type ConversationFilter = "all" | "bot" | "human" | "resolved";

export interface Agent {
  id: number;
  name: string;
  email: string;
  password?: string;
  role: AgentRole;
  status: AgentStatus;
  initials: string | null;
  avatar_color: string | null;
  avatar_bg: string | null;
  max_conversations: number | null;
  created_at: string | null;
  updated_at: string | null;
}

export interface Client {
  id: number;
  name: string;
  phone: string;
  plan: string | null;
  zone: string | null;
  account: ClientAccountStatus | null;
  wispro_id?: string | null;
  whatsapp_id?: string | null;
  wa_name?: string | null;
  color: string | null;
  bg: string | null;
  initials: string | null;
  envoicing?: string | null;
  created_at: string | null;
}

export interface WisproInvoicingSummary {
  debt: number;
  hasDebt: boolean;
  accountStatus: ClientAccountStatus;
  snapshot: {
    invoiceIndex: number;
    itemIndex: number;
    gross_amount: number;
    amount: number;
  } | null;
}

export interface WisproSearchResult {
  customer: WisproCustomer;
  invoicing: WisproInvoicingSummary;
}

export interface WisproCustomer {
  id: string;
  name: string;
  national_identification_number: string;
  phone_mobile?: string | null;
  zone_name?: string | null;
  city?: string | null;
  state?: string | null;
}

export interface AssociateWisproInput {
  conversationId: number;
  customer: WisproCustomer;
  invoicing: WisproInvoicingSummary;
  existingClientsCount?: number;
  existingClientId?: number | null;
  conversationPhone?: string | null;
  whatsappId?: string | null;
  waName?: string | null;
}

export interface Conversation {
  id: number;
  client_id: number | null;
  status: ConversationStatus;
  human_mode: boolean;
  label_ids: number[];
  preview: string | null;
  unread: number | null;
  agent_id: number | null;
  wa_phone_number_id?: string | null;
  last_message_at?: string | null;
  updated_at: string | null;
  created_at: string | null;
}

export interface Message {
  id: number;
  conversation_id: number;
  wa_message_id?: string | null;
  type: MessageType;
  content: string;
  media_url?: string | null;
  media_type?: MessageMediaType | null;
  sender_type: MessageSenderType;
  status?: "sent" | "delivered" | "read" | "failed" | null;
  created_at: string | null;
}

export interface Label {
  id: number;
  name: string;
  color: string;
  bg: string;
  created_at: string | null;
}

export interface Ticket {
  id: string;
  client_id: number;
  type: string;
  status: TicketStatus;
  agent: string;
  description: string | null;
  created_at: string | null;
}

export interface CrmData {
  agents: Agent[];
  clients: Client[];
  conversations: Conversation[];
  labels: Label[];
  tickets: Ticket[];
}

export interface CreateClientInput {
  name: string;
  phone: string;
  plan: string;
  zone: string;
  account: ClientAccountStatus;
}

export interface CreateTicketInput {
  clientId: number;
  type: string;
  agent: string;
  description: string;
}

export interface CreateLabelInput {
  name: string;
  color: string;
  bg: string;
}

export interface UpsertAgentInput {
  id?: number;
  name: string;
  email: string;
  password?: string;
  role: AgentRole;
  initials: string;
  maxConversations: number;
}
