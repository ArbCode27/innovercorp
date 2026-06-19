"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import { toast } from "sonner";
import { crmService } from "../_lib/crm-service";
import { useSendMessage } from "./use-send-message";
import type {
  Agent,
  Client,
  Conversation,
  ConversationFilter,
  CreateClientInput,
  CreateLabelInput,
  CreateTicketInput,
  CrmData,
  Label,
  Message,
  Ticket,
  UpsertAgentInput,
} from "../_lib/types";

const emptyData: CrmData = {
  agents: [],
  clients: [],
  conversations: [],
  labels: [],
  tickets: [],
};

export const useCrmData = (agent: Agent | null) => {
  const [data, setData] = useState<CrmData>(emptyData);
  const [messages, setMessages] = useState<Message[]>([]);
  const [selectedConversationId, setSelectedConversationId] = useState<number | null>(null);
  const [isLoading, setIsLoading] = useState(false);
  const [isMessagesLoading, setIsMessagesLoading] = useState(false);
  const [searchTerm, setSearchTerm] = useState("");
  const [conversationFilter, setConversationFilter] =
    useState<ConversationFilter>("all");
  const [selectedLabelId, setSelectedLabelId] = useState<number | null>(null);
  const { sendMessage: sendWhatsAppMessage, isSending: isSendingMessage } =
    useSendMessage();

  const loadData = useCallback(async () => {
    if (!agent) return;

    setIsLoading(true);
    try {
      const nextData = await crmService.loadAll(agent);
      setData(nextData);
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "No se pudo cargar el CRM");
    } finally {
      setIsLoading(false);
    }
  }, [agent]);

  useEffect(() => {
    loadData();
  }, [loadData]);

  const selectedConversation = useMemo(
    () =>
      data.conversations.find(
        (conversation) => conversation.id === selectedConversationId
      ) || null,
    [data.conversations, selectedConversationId]
  );

  const selectedClient = useMemo(() => {
    if (!selectedConversation?.client_id) return null;
    return (
      data.clients.find((client) => client.id === selectedConversation.client_id) ||
      null
    );
  }, [data.clients, selectedConversation]);

  const filteredConversations = useMemo(() => {
    const query = searchTerm.trim().toLowerCase();

    return data.conversations.filter((conversation) => {
      const client = data.clients.find((item) => item.id === conversation.client_id);
      const name = client?.name || "Número desconocido";
      const matchesSearch =
        !query ||
        name.toLowerCase().includes(query) ||
        (conversation.phone || "").toLowerCase().includes(query);

      if (!matchesSearch) return false;
      if (conversationFilter === "bot" && conversation.human_mode) return false;
      if (conversationFilter === "human" && !conversation.human_mode) return false;
      if (conversationFilter === "resolved" && conversation.status !== "resuelto") {
        return false;
      }
      if (selectedLabelId && !conversation.label_ids.includes(selectedLabelId)) {
        return false;
      }

      return true;
    });
  }, [
    conversationFilter,
    data.clients,
    data.conversations,
    searchTerm,
    selectedLabelId,
  ]);

  const selectConversation = async (conversationId: number) => {
    setSelectedConversationId(conversationId);
    setIsMessagesLoading(true);

    try {
      const conversation = data.conversations.find((item) => item.id === conversationId);
      if (conversation?.unread) {
        await crmService.clearUnread(conversationId);
        setData((current) => ({
          ...current,
          conversations: current.conversations.map((item) =>
            item.id === conversationId ? { ...item, unread: 0 } : item
          ),
        }));
      }

      const loadedMessages = await crmService.loadMessages(conversationId);
      setMessages(loadedMessages);
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "No se pudo abrir la conversación");
    } finally {
      setIsMessagesLoading(false);
    }
  };

  const sendMessage = async (content: string) => {
    if (!selectedConversation) return;

    const trimmedContent = content.trim();
    if (!trimmedContent) {
      throw new Error("El mensaje no puede estar vacío");
    }

    const to = selectedConversation.phone || selectedClient?.phone;
    if (!to) {
      throw new Error("La conversación no tiene un número de teléfono válido");
    }

    const response = await sendWhatsAppMessage({
      to,
      message: trimmedContent,
      conversation_id: selectedConversation.id,
      agent_id: selectedConversation.human_mode ? agent?.id : undefined,
    });

    setMessages((current) => [...current, response.message]);
    setData((current) => ({
      ...current,
      conversations: current.conversations.map((conversation) =>
        conversation.id === selectedConversation.id
          ? {
              ...conversation,
              preview: trimmedContent,
              updated_at: new Date().toISOString(),
            }
          : conversation
      ),
    }));
  };

  const addNote = async (content: string) => {
    if (!selectedConversation) return;

    const saved = await crmService.addNote(selectedConversation.id, content);
    setMessages((current) => [...current, saved]);
    toast.info("Nota agregada");
  };

  const updateConversationLocal = (conversation: Conversation) => {
    setData((current) => ({
      ...current,
      conversations: current.conversations.map((item) =>
        item.id === conversation.id ? conversation : item
      ),
    }));
  };

  const takeControl = async () => {
    if (!selectedConversation) return;

    await crmService.updateConversation(selectedConversation.id, { human_mode: true });
    updateConversationLocal({ ...selectedConversation, human_mode: true });
    toast.warning("Control tomado");
  };

  const reactivateBot = async () => {
    if (!selectedConversation) return;

    await crmService.updateConversation(selectedConversation.id, { human_mode: false });
    updateConversationLocal({ ...selectedConversation, human_mode: false });
    toast.success("Bot IA reactivado");
  };

  const resolveConversation = async () => {
    if (!selectedConversation) return;

    await crmService.updateConversation(selectedConversation.id, { status: "resuelto" });
    await crmService.resolveTicketForClient(selectedConversation.client_id);
    updateConversationLocal({ ...selectedConversation, status: "resuelto" });
    await loadData();
    toast.success("Conversación resuelta");
  };

  const updateLabels = async (labelIds: number[]) => {
    if (!selectedConversation) return;

    await crmService.updateConversation(selectedConversation.id, { label_ids: labelIds });
    updateConversationLocal({ ...selectedConversation, label_ids: labelIds });
    toast.success("Etiquetas actualizadas");
  };

  const quickToggleLabel = async (labelId: number) => {
    if (!selectedConversation) return;

    const exists = selectedConversation.label_ids.includes(labelId);
    const labelIds = exists
      ? selectedConversation.label_ids.filter((id) => id !== labelId)
      : [...selectedConversation.label_ids, labelId];

    await updateLabels(labelIds);
  };

  const assignAgent = async (conversationId: number, agentId: number) => {
    await crmService.updateConversation(conversationId, {
      agent_id: agentId,
      human_mode: true,
    });
    await loadData();
    toast.success("Conversación asignada");
  };

  const createClient = async (input: CreateClientInput) => {
    const saved = await crmService.createClient(input, data.clients.length);
    setData((current) => ({ ...current, clients: [...current.clients, saved] }));
    toast.success(`${saved.name} agregado`);
  };

  const createTicket = async (input: CreateTicketInput) => {
    const saved = await crmService.createTicket(input);
    setData((current) => ({ ...current, tickets: [saved, ...current.tickets] }));
    toast.success(`${saved.id} creado`);
  };

  const createLabel = async (input: CreateLabelInput) => {
    const saved = await crmService.createLabel(input);
    setData((current) => ({ ...current, labels: [...current.labels, saved] }));
    toast.success(`"${saved.name}" creada`);
  };

  const deleteLabel = async (label: Label) => {
    await crmService.deleteLabel(label.id, data.conversations);
    await loadData();
    toast.warning(`"${label.name}" eliminada`);
  };

  const upsertAgent = async (input: UpsertAgentInput) => {
    await crmService.upsertAgent(input, data.agents.length);
    await loadData();
    toast.success(input.id ? "Agente actualizado" : "Agente creado");
  };

  const toggleAgentStatus = async (targetAgent: Agent) => {
    const nextStatus = targetAgent.status === "inactive" ? "offline" : "inactive";
    await crmService.updateAgentStatus(targetAgent.id, nextStatus);
    await loadData();
    toast.info(nextStatus === "inactive" ? "Agente desactivado" : "Agente activado");
  };

  const clientsById = useMemo(
    () => new Map<number, Client>(data.clients.map((client) => [client.id, client])),
    [data.clients]
  );

  const labelsById = useMemo(
    () => new Map<number, Label>(data.labels.map((label) => [label.id, label])),
    [data.labels]
  );

  const ticketsByClientId = useMemo(() => {
    const map = new Map<number, Ticket[]>();
    data.tickets.forEach((ticket) => {
      const list = map.get(ticket.client_id) || [];
      map.set(ticket.client_id, [...list, ticket]);
    });
    return map;
  }, [data.tickets]);

  return {
    ...data,
    messages,
    selectedConversation,
    selectedClient,
    selectedConversationId,
    filteredConversations,
    clientsById,
    labelsById,
    ticketsByClientId,
    isLoading,
    isMessagesLoading,
    isSendingMessage,
    searchTerm,
    conversationFilter,
    selectedLabelId,
    setSearchTerm,
    setConversationFilter,
    setSelectedLabelId,
    loadData,
    selectConversation,
    sendMessage,
    addNote,
    takeControl,
    reactivateBot,
    resolveConversation,
    updateLabels,
    quickToggleLabel,
    assignAgent,
    createClient,
    createTicket,
    createLabel,
    deleteLabel,
    upsertAgent,
    toggleAgentStatus,
  };
};
