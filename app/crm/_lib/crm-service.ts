"use client";

import { CRM_COLORS } from "./constants";
import { createTicketId, getColorByIndex, getInitials } from "./formatters";
import { getSupabaseClient } from "./supabase";
import type {
  Agent,
  AgentStatus,
  Conversation,
  CreateClientInput,
  CreateLabelInput,
  CreateQuickReplyInput,
  CreateTicketInput,
  CrmData,
  Label,
  Message,
  QuickReply,
  Ticket,
  Client,
  ConversationHistory,
  UpdateQuickReplyInput,
  UpsertAgentInput,
} from "./types";

const db = () => getSupabaseClient();

const throwIfError = (error: unknown) => {
  if (error) throw error;
};

const ensureData = <T,>(data: T | null, message: string) => {
  if (!data) throw new Error(message);
  return data;
};

const normalizeShortcut = (value?: string) => {
  const trimmed = value?.trim().toLowerCase() ?? "";
  if (!trimmed) return null;

  const normalized = trimmed
    .replace(/^\/+/, "")
    .replace(/\s+/g, "-")
    .replace(/[^a-z0-9_-]/g, "");

  return normalized || null;
};

export const crmService = {
  async loginAgent(email: string, password: string) {
    const { data, error } = await db()
      .from("agents")
      .select("*")
      .eq("email", email)
      .eq("password", password)
      .single<Agent>();

    throwIfError(error);
    const agent = ensureData(data, "Correo o contraseña incorrectos");

    if (agent.status === "inactive") {
      throw new Error("Tu cuenta está inactiva. Contacta al administrador.");
    }

    await this.updateAgentStatus(agent.id, "online");
    return { ...agent, status: "online" as const };
  },

  async updateAgentStatus(id: number, status: AgentStatus) {
    const { error } = await db()
      .from("agents")
      .update({ status, updated_at: new Date().toISOString() })
      .eq("id", id);

    throwIfError(error);
  },

  async loadAll(currentAgent: Agent): Promise<CrmData> {
    const [labels, clients, tickets, conversations, agents, quickReplies] = await Promise.all([
      db().from("labels").select("*").order("created_at"),
      db().from("clients").select("*").order("created_at"),
      db().from("tickets").select("*").order("created_at", { ascending: false }),
      db().from("conversations").select("*").order("updated_at", { ascending: false }),
      db().from("agents").select("*").order("created_at"),
      db().from("quick_replies").select("*").order("title"),
    ]);

    [labels, clients, tickets, conversations, agents, quickReplies].forEach((result) =>
      throwIfError(result.error)
    );

    const rawConversations = ((conversations.data || []) as Conversation[]).map(
      (conversation) => ({
        ...conversation,
        label_ids: conversation.label_ids || [],
        human_mode: Boolean(conversation.human_mode),
      })
    );

    return {
      labels: (labels.data || []) as Label[],
      clients: (clients.data || []) as Client[],
      tickets: (tickets.data || []) as Ticket[],
      quickReplies: (quickReplies.data || []) as QuickReply[],
      conversations:
        currentAgent.role === "agent"
          ? rawConversations.filter(
              (conversation) =>
                !conversation.agent_id || conversation.agent_id === currentAgent.id
            )
          : rawConversations,
      agents: (agents.data || []) as Agent[],
    };
  },

  async loadMessages(conversationId: number) {
    const { data, error } = await db()
      .from("messages")
      .select("*")
      .eq("conversation_id", conversationId)
      .order("created_at");

    throwIfError(error);
    return (data || []) as Message[];
  },

  async clearUnread(conversationId: number) {
    const { error } = await db()
      .from("conversations")
      .update({ unread: 0 })
      .eq("id", conversationId);

    throwIfError(error);
  },

  async sendMessage(conversationId: number, content: string, senderType: "agent" | "bot") {
    const now = new Date().toISOString();
    const { data, error } = await db()
      .from("messages")
      .insert({
        conversation_id: conversationId,
        type: "out",
        content,
        sender_type: senderType,
      })
      .select()
      .single<Message>();

    throwIfError(error);

    const { error: conversationError } = await db()
      .from("conversations")
      .update({ preview: content, updated_at: now })
      .eq("id", conversationId);

    throwIfError(conversationError);
    return ensureData(data, "No se pudo guardar el mensaje");
  },

  async addNote(conversationId: number, content: string) {
    const { data, error } = await db()
      .from("messages")
      .insert({
        conversation_id: conversationId,
        type: "note",
        content,
        sender_type: "agent",
      })
      .select()
      .single<Message>();

    throwIfError(error);
    return ensureData(data, "No se pudo guardar la nota");
  },

  async updateConversation(
    conversationId: number,
    payload: Partial<
      Pick<
        Conversation,
        "human_mode" | "status" | "label_ids" | "agent_id" | "agent_control"
      >
    >
  ) {
    const { error } = await db()
      .from("conversations")
      .update({ ...payload, updated_at: new Date().toISOString() })
      .eq("id", conversationId);

    throwIfError(error);
  },

  async resolveTicketForClient(clientId: number | null) {
    if (!clientId) return;

    const { data } = await db()
      .from("tickets")
      .select("*")
      .eq("client_id", clientId)
      .neq("status", "Resuelto")
      .limit(1)
      .maybeSingle<Ticket>();

    if (!data) return;

    const { error } = await db()
      .from("tickets")
      .update({ status: "Resuelto" })
      .eq("id", data.id);

    throwIfError(error);
  },

  async archiveAndResolveConversation(
    conversationId: number,
    resolvedBy: number,
  ): Promise<number> {
    const response = await fetch("/api/crm/conversations/resolve", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ conversationId, resolvedBy }),
    });

    const payload = (await response.json()) as {
      historyId?: number;
      error?: string;
    };

    if (!response.ok) {
      throw new Error(payload.error || "No se pudo archivar la conversación");
    }

    if (!payload.historyId) {
      throw new Error("No se recibió el historial de la conversación");
    }

    return payload.historyId;
  },

  async loadConversationHistory(): Promise<ConversationHistory[]> {
    const response = await fetch("/api/crm/conversations/history");

    const payload = (await response.json()) as {
      entries?: ConversationHistory[];
      error?: string;
    };

    if (!response.ok) {
      throw new Error(
        payload.error || "No se pudo cargar el historial de conversaciones",
      );
    }

    return payload.entries ?? [];
  },

  async createClient(input: CreateClientInput, existingClients: number) {
    const color = getColorByIndex(existingClients);
    const { data, error } = await db()
      .from("clients")
      .insert({
        name: input.name,
        phone: input.phone,
        plan: input.plan,
        zone: input.zone,
        account: input.account,
        color: color.color,
        bg: color.bg,
        initials: getInitials(input.name),
      })
      .select()
      .single<Client>();

    throwIfError(error);
    return ensureData(data, "No se pudo crear el cliente");
  },

  async createTicket(input: CreateTicketInput) {
    const { data, error } = await db()
      .from("tickets")
      .insert({
        id: createTicketId(),
        client_id: input.clientId,
        type: input.type,
        status: "Abierto",
        agent: input.agent,
        description: input.description,
      })
      .select()
      .single<Ticket>();

    throwIfError(error);
    return ensureData(data, "No se pudo crear el ticket");
  },

  async createLabel(input: CreateLabelInput) {
    const { data, error } = await db()
      .from("labels")
      .insert(input)
      .select()
      .single<Label>();

    throwIfError(error);
    return ensureData(data, "No se pudo crear la etiqueta");
  },

  async createQuickReply(input: CreateQuickReplyInput, createdBy: number) {
    const title = input.title.trim();
    const content = input.content.trim();
    if (!title) throw new Error("El título es requerido");
    if (!content) throw new Error("El contenido es requerido");

    const shortcut = normalizeShortcut(input.shortcut);
    const category = input.category?.trim() || null;

    const { data, error } = await db()
      .from("quick_replies")
      .insert({
        title,
        content,
        shortcut,
        category,
        is_active: true,
        created_by: createdBy,
      })
      .select()
      .single<QuickReply>();

    throwIfError(error);
    return ensureData(data, "No se pudo crear la respuesta rápida");
  },

  async updateQuickReply(id: number, input: UpdateQuickReplyInput) {
    const title = input.title.trim();
    const content = input.content.trim();
    if (!title) throw new Error("El título es requerido");
    if (!content) throw new Error("El contenido es requerido");

    const shortcut = normalizeShortcut(input.shortcut);
    const category = input.category?.trim() || null;

    const payload = {
      title,
      content,
      shortcut,
      category,
      ...(typeof input.is_active === "boolean"
        ? { is_active: input.is_active }
        : {}),
      updated_at: new Date().toISOString(),
    };

    const { data, error } = await db()
      .from("quick_replies")
      .update(payload)
      .eq("id", id)
      .select()
      .single<QuickReply>();

    throwIfError(error);
    return ensureData(data, "No se pudo actualizar la respuesta rápida");
  },

  async toggleQuickReplyStatus(id: number, isActive: boolean) {
    const { data, error } = await db()
      .from("quick_replies")
      .update({
        is_active: isActive,
        updated_at: new Date().toISOString(),
      })
      .eq("id", id)
      .select()
      .single<QuickReply>();

    throwIfError(error);
    return ensureData(data, "No se pudo actualizar el estado de la respuesta rápida");
  },

  async deleteQuickReply(id: number) {
    const { error } = await db()
      .from("quick_replies")
      .delete()
      .eq("id", id);

    throwIfError(error);
  },

  async deleteLabel(labelId: number, conversations: Conversation[]) {
    const { error } = await db().from("labels").delete().eq("id", labelId);
    throwIfError(error);

    const affected = conversations.filter((conversation) =>
      conversation.label_ids.includes(labelId)
    );

    await Promise.all(
      affected.map((conversation) =>
        this.updateConversation(conversation.id, {
          label_ids: conversation.label_ids.filter((id) => id !== labelId),
        })
      )
    );
  },

  async upsertAgent(input: UpsertAgentInput, existingAgents: number) {
    const color = CRM_COLORS[existingAgents % CRM_COLORS.length];
    const payload = {
      name: input.name,
      email: input.email,
      role: input.role,
      max_conversations: input.maxConversations,
      initials: input.initials,
      updated_at: new Date().toISOString(),
      ...(input.password ? { password: input.password } : {}),
    };

    if (input.id) {
      const { error } = await db().from("agents").update(payload).eq("id", input.id);
      throwIfError(error);
      return;
    }

    const { error } = await db()
      .from("agents")
      .insert({
        ...payload,
        avatar_color: color.color,
        avatar_bg: color.bg,
        status: "offline",
      });

    throwIfError(error);
  },
};
