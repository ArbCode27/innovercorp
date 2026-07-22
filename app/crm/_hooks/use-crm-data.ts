"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { toast } from "sonner";
import { createClient } from "@supabase/supabase-js";
import { crmService } from "../_lib/crm-service";
import {
  filterConversations,
  getConversationFilterCounts,
} from "../_lib/conversation-filter-utils";
import {
  applyInboundMessageToConversation,
  sortConversationsForInbox,
} from "../_lib/conversation-inbox-utils";
import { wisproService } from "../_lib/wispro-service";
import { isAdminRole } from "../_lib/agent-role-utils";
import { useSendMessage } from "./use-send-message";
import type {
  Agent,
  Client,
  Conversation,
  ConversationFilter,
  CreateClientInput,
  CreateLabelInput,
  CreateQuickReplyInput,
  CreateTicketInput,
  CrmData,
  Label,
  Message,
  QuickReply,
  Ticket,
  UpdateQuickReplyInput,
  UpsertAgentInput,
  WisproCustomer,
  WisproSearchResult,
} from "../_lib/types";

// ── Supabase client para Realtime ─────────────────────────
const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
);

const emptyData: CrmData = {
  agents: [],
  clients: [],
  conversations: [],
  labels: [],
  quickReplies: [],
  tickets: [],
};

const MAX_WHATSAPP_AUDIO_BYTES = 16 * 1024 * 1024;
const MAX_WHATSAPP_IMAGE_BYTES = 5 * 1024 * 1024;
const formatVoiceNotePreview = (durationMs: number) => {
  const totalSeconds = Math.max(0, Math.floor(durationMs / 1000));
  const minutes = Math.floor(totalSeconds / 60);
  const seconds = String(totalSeconds % 60).padStart(2, "0");
  return `🎤 Nota de voz (${minutes}:${seconds})`;
};

export const useCrmData = (agent: Agent | null) => {
  const [data, setData] = useState<CrmData>(emptyData);
  const [messages, setMessages] = useState<Message[]>([]);
  const [selectedConversationId, setSelectedConversationId] = useState<
    number | null
  >(null);
  const [isLoading, setIsLoading] = useState(false);
  const [isMessagesLoading, setIsMessagesLoading] = useState(false);
  const [searchTerm, setSearchTerm] = useState("");
  const [conversationFilter, setConversationFilter] =
    useState<ConversationFilter>("all");
  const [selectedLabelId, setSelectedLabelId] = useState<number | null>(null);
  const [myAssignedSearchTerm, setMyAssignedSearchTerm] = useState("");
  const [myAssignedIncludeResolved, setMyAssignedIncludeResolved] =
    useState(false);
  const [wisproSnapshotsByClientId, setWisproSnapshotsByClientId] = useState<
    Record<number, WisproCustomer>
  >({});
  const {
    sendMessage: sendWhatsAppMessage,
    sendVoiceNote: sendWhatsAppVoiceNote,
    sendImageMessage: sendWhatsAppImageMessage,
    isSending: isSendingMessage,
  } = useSendMessage();
  const [isResolvingConversation, setIsResolvingConversation] = useState(false);

  // Ref para acceder al selectedConversationId dentro de los listeners de Realtime
  const selectedConversationIdRef = useRef<number | null>(null);
  useEffect(() => {
    selectedConversationIdRef.current = selectedConversationId;
  }, [selectedConversationId]);

  // ── REALTIME: mensajes nuevos ──────────────────────────
  useEffect(() => {
    const channel = supabase
      .channel("realtime:messages")
      .on(
        "postgres_changes",
        {
          event: "INSERT",
          schema: "public",
          table: "messages",
        },
        (payload) => {
          const newMessage = payload.new as Message;
          const isOpenConversation =
            newMessage.conversation_id === selectedConversationIdRef.current;

          if (isOpenConversation) {
            setMessages((current) => {
              const exists = current.some((m) => m.id === newMessage.id);
              if (exists) return current;
              return [...current, newMessage];
            });
            return;
          }

          if (newMessage.type !== "in") return;

          setData((current) => ({
            ...current,
            conversations: current.conversations.map((conversation) =>
              conversation.id === newMessage.conversation_id
                ? applyInboundMessageToConversation(conversation, newMessage, {
                    incrementUnread: true,
                  })
                : conversation,
            ),
          }));
        },
      )
      .subscribe((status) => {
        if (status === "SUBSCRIBED") {
          console.log("✅ Realtime mensajes conectado");
        }
      });

    return () => {
      supabase.removeChannel(channel);
    };
  }, []);

  // ── REALTIME: conversaciones ───────────────────────────
  useEffect(() => {
    const channel = supabase
      .channel("realtime:conversations")
      .on(
        "postgres_changes",
        {
          event: "INSERT",
          schema: "public",
          table: "conversations",
        },
        (payload) => {
          const newConv = payload.new as Conversation;
          setData((current) => ({
            ...current,
            conversations: [newConv, ...current.conversations],
          }));
        },
      )
      .on(
        "postgres_changes",
        {
          event: "UPDATE",
          schema: "public",
          table: "conversations",
        },
        (payload) => {
          const updated = payload.new as Conversation;
          setData((current) => ({
            ...current,
            conversations: current.conversations.map((conv) =>
              conv.id === updated.id ? { ...conv, ...updated } : conv,
            ),
          }));
        },
      )
      .on(
        "postgres_changes",
        {
          event: "DELETE",
          schema: "public",
          table: "conversations",
        },
        (payload) => {
          const deletedId = (payload.old as { id?: number }).id;
          if (!deletedId) return;

          setData((current) => ({
            ...current,
            conversations: current.conversations.filter(
              (conv) => conv.id !== deletedId,
            ),
          }));

          if (selectedConversationIdRef.current === deletedId) {
            setSelectedConversationId(null);
            setMessages([]);
          }
        },
      )
      .subscribe((status) => {
        if (status === "SUBSCRIBED") {
          console.log("✅ Realtime conversaciones conectado");
        }
      });

    return () => {
      supabase.removeChannel(channel);
    };
  }, []);

  // ── REALTIME: clientes ─────────────────────────────────
  useEffect(() => {
    const channel = supabase
      .channel("realtime:clients")
      .on(
        "postgres_changes",
        {
          event: "INSERT",
          schema: "public",
          table: "clients",
        },
        (payload) => {
          const newClient = payload.new as Client;
          setData((current) => {
            const exists = current.clients.some((client) => client.id === newClient.id);
            if (exists) return current;

            return {
              ...current,
              clients: [...current.clients, newClient],
            };
          });
        },
      )
      .on(
        "postgres_changes",
        {
          event: "UPDATE",
          schema: "public",
          table: "clients",
        },
        (payload) => {
          const updatedClient = payload.new as Client;
          setData((current) => ({
            ...current,
            clients: current.clients.map((client) =>
              client.id === updatedClient.id ? { ...client, ...updatedClient } : client,
            ),
          }));
        },
      )
      .subscribe((status) => {
        if (status === "SUBSCRIBED") {
          console.log("✅ Realtime clientes conectado");
        }
      });

    return () => {
      supabase.removeChannel(channel);
    };
  }, []);

  const loadData = useCallback(async () => {
    if (!agent) return;

    setIsLoading(true);
    try {
      const nextData = await crmService.loadAll(agent);
      setData(nextData);
    } catch (error) {
      toast.error(
        error instanceof Error ? error.message : "No se pudo cargar el CRM",
      );
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
        (conversation) => conversation.id === selectedConversationId,
      ) || null,
    [data.conversations, selectedConversationId],
  );

  const clientsById = useMemo(
    () =>
      new Map<number, Client>(
        data.clients.map((client) => [client.id, client]),
      ),
    [data.clients],
  );

  const selectedClient = useMemo(() => {
    if (!selectedConversation?.client_id) return null;
    return clientsById.get(selectedConversation.client_id) ?? null;
  }, [clientsById, selectedConversation?.client_id]);

  const selectedWisproSnapshot = useMemo(() => {
    if (!selectedClient) return null;
    return wisproSnapshotsByClientId[selectedClient.id] ?? null;
  }, [selectedClient, wisproSnapshotsByClientId]);

  const myAssignedConversations = useMemo(() => {
    if (!agent) return [];

    return data.conversations.filter(
      (conversation) => conversation.agent_id === agent.id,
    );
  }, [agent, data.conversations]);

  const filteredMyAssignedConversations = useMemo(() => {
    const query = myAssignedSearchTerm.trim().toLowerCase();

    return sortConversationsForInbox(
      myAssignedConversations.filter((conversation) => {
      if (
        !myAssignedIncludeResolved &&
        conversation.status === "resuelto"
      ) {
        return false;
      }

      const client = data.clients.find(
        (item) => item.id === conversation.client_id,
      );
      const name = client?.name || "Número desconocido";

      if (!query) return true;

      return (
        name.toLowerCase().includes(query) ||
        (client?.phone || "").toLowerCase().includes(query) ||
        (client?.whatsapp_id || "").toLowerCase().includes(query)
      );
    }),
    );
  }, [
    data.clients,
    myAssignedConversations,
    myAssignedIncludeResolved,
    myAssignedSearchTerm,
  ]);

  const myActiveAssignedCount = useMemo(
    () =>
      myAssignedConversations.filter(
        (conversation) => conversation.status !== "resuelto",
      ).length,
    [myAssignedConversations],
  );

  const filteredConversations = useMemo(
    () =>
      sortConversationsForInbox(
        filterConversations(data.conversations, clientsById, {
          searchTerm,
          selectedLabelId,
          modeFilter: conversationFilter,
        }),
      ),
    [
      clientsById,
      conversationFilter,
      data.conversations,
      searchTerm,
      selectedLabelId,
    ],
  );

  const conversationFilterCounts = useMemo(
    () =>
      getConversationFilterCounts(
        data.conversations,
        clientsById,
        searchTerm,
        selectedLabelId,
      ),
    [clientsById, data.conversations, searchTerm, selectedLabelId],
  );

  const selectConversation = async (conversationId: number | null) => {
    if (conversationId === null) {
      setSelectedConversationId(null);
      setMessages([]);
      return;
    }

    setSelectedConversationId(conversationId);

    const conversation = data.conversations.find(
      (item) => item.id === conversationId,
    );

    if (conversation?.unread) {
      setData((current) => ({
        ...current,
        conversations: current.conversations.map((item) =>
          item.id === conversationId ? { ...item, unread: 0 } : item,
        ),
      }));
    }

    setIsMessagesLoading(true);

    try {
      if (conversation?.unread) {
        await crmService.clearUnread(conversationId);
      }

      const loadedMessages = await crmService.loadMessages(conversationId);
      setMessages(loadedMessages);
    } catch (error) {
      toast.error(
        error instanceof Error
          ? error.message
          : "No se pudo abrir la conversación",
      );
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

    const to =
      selectedClient?.phone ||
      selectedClient?.whatsapp_id ||
      null;
    if (!to) {
      throw new Error(
        "Asocia un cliente con teléfono válido antes de enviar mensajes",
      );
    }

    const response = await sendWhatsAppMessage({
      to,
      message: trimmedContent,
      conversation_id: selectedConversation.id,
      agent_id: selectedConversation.human_mode ? agent?.id : undefined,
    });

    // Agregar optimistamente — Realtime lo deduplicará si llega de nuevo
    setMessages((current) => {
      const exists = current.some((m) => m.id === response.message.id);
      if (exists) return current;
      return [...current, response.message];
    });

    setData((current) => ({
      ...current,
      conversations: current.conversations.map((conversation) =>
        conversation.id === selectedConversation.id
          ? {
              ...conversation,
              preview: trimmedContent,
              updated_at: new Date().toISOString(),
            }
          : conversation,
      ),
    }));
  };

  const sendVoiceNote = async (
    audioBlob: Blob,
    meta: { durationMs: number; mimeType: string },
  ) => {
    if (!selectedConversation) return;
    if (!agent) {
      throw new Error("Debes iniciar sesión como agente para enviar notas de voz");
    }
    if (!selectedConversation.human_mode) {
      throw new Error(
        "Toma control de la conversación antes de enviar una nota de voz",
      );
    }

    if (!audioBlob || audioBlob.size <= 0) {
      throw new Error("Graba una nota de voz válida antes de enviarla");
    }

    if (audioBlob.size > MAX_WHATSAPP_AUDIO_BYTES) {
      throw new Error("La nota de voz supera el límite de 16 MB");
    }

    const normalizedAudio = new Blob([audioBlob], {
      type: meta.mimeType || audioBlob.type || "audio/webm",
    });

    const to = selectedClient?.phone || selectedClient?.whatsapp_id || null;
    if (!to) {
      throw new Error(
        "Asocia un cliente con teléfono válido antes de enviar mensajes",
      );
    }

    const response = await sendWhatsAppVoiceNote({
      to,
      audio: normalizedAudio,
      conversation_id: selectedConversation.id,
      duration_ms: meta.durationMs,
      agent_id: agent.id,
    });

    const preview = response.message.content || formatVoiceNotePreview(meta.durationMs);

    setMessages((current) => {
      const exists = current.some((message) => message.id === response.message.id);
      if (exists) return current;
      return [...current, response.message];
    });

    setData((current) => ({
      ...current,
      conversations: current.conversations.map((conversation) =>
        conversation.id === selectedConversation.id
          ? {
              ...conversation,
              preview,
              updated_at: new Date().toISOString(),
            }
          : conversation,
      ),
    }));
  };

  const sendImageMessage = async (imageFile: File, caption?: string) => {
    if (!selectedConversation) return;
    if (!agent) {
      throw new Error("Debes iniciar sesión como agente para enviar imágenes");
    }
    if (!selectedConversation.human_mode) {
      throw new Error(
        "Toma control de la conversación antes de enviar una imagen",
      );
    }

    if (!(imageFile instanceof File) || imageFile.size <= 0) {
      throw new Error("Selecciona una imagen válida antes de enviarla");
    }
    if (imageFile.size > MAX_WHATSAPP_IMAGE_BYTES) {
      throw new Error("La imagen supera el límite de 5 MB");
    }

    const to = selectedClient?.phone || selectedClient?.whatsapp_id || null;
    if (!to) {
      throw new Error(
        "Asocia un cliente con teléfono válido antes de enviar mensajes",
      );
    }

    const trimmedCaption = caption?.trim();
    const response = await sendWhatsAppImageMessage({
      to,
      image: imageFile,
      conversation_id: selectedConversation.id,
      agent_id: agent.id,
      caption: trimmedCaption,
    });

    const preview = trimmedCaption || "Imagen";

    setMessages((current) => {
      const exists = current.some((message) => message.id === response.message.id);
      if (exists) return current;
      return [...current, response.message];
    });

    setData((current) => ({
      ...current,
      conversations: current.conversations.map((conversation) =>
        conversation.id === selectedConversation.id
          ? {
              ...conversation,
              preview,
              updated_at: new Date().toISOString(),
            }
          : conversation,
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
        item.id === conversation.id ? conversation : item,
      ),
    }));
  };

  const takeControl = async () => {
    if (!selectedConversation || !agent) return;

    const nextConversation = {
      ...selectedConversation,
      human_mode: true,
      agent_id: agent.id,
      agent_control: agent.name,
    };
    await crmService.updateConversation(selectedConversation.id, {
      human_mode: true,
      agent_id: agent.id,
      agent_control: agent.name,
    });
    updateConversationLocal(nextConversation);
    toast.warning("Control tomado");
  };

  const reactivateBot = async () => {
    if (!selectedConversation) return;

    await crmService.updateConversation(selectedConversation.id, {
      human_mode: false,
      agent_control: null,
    });
    updateConversationLocal({
      ...selectedConversation,
      human_mode: false,
      agent_control: null,
    });
    toast.success("Bot IA reactivado");
  };

  const resolveConversation = async () => {
    if (!selectedConversation || !agent) return;

    const resolvedConversationId = selectedConversation.id;

    setIsResolvingConversation(true);

    try {
      await crmService.archiveAndResolveConversation(
        resolvedConversationId,
        agent.id,
      );

      setData((current) => ({
        ...current,
        conversations: current.conversations.filter(
          (conversation) => conversation.id !== resolvedConversationId,
        ),
      }));

      if (selectedConversationId === resolvedConversationId) {
        setSelectedConversationId(null);
        setMessages([]);
      }

      toast.success("Conversación archivada y cerrada");
    } catch (error) {
      toast.error(
        error instanceof Error
          ? error.message
          : "No se pudo archivar la conversación",
      );
    } finally {
      setIsResolvingConversation(false);
    }
  };

  const updateLabels = async (labelIds: number[]) => {
    if (!selectedConversation) return;

    await crmService.updateConversation(selectedConversation.id, {
      label_ids: labelIds,
    });
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
    const assignedAgent = data.agents.find((item) => item.id === agentId);
    await crmService.updateConversation(conversationId, {
      agent_id: agentId,
      human_mode: true,
      agent_control: assignedAgent?.name ?? null,
    });
    await loadData();
    toast.success("Conversación asignada");
  };

  const createClient = async (input: CreateClientInput) => {
    const saved = await crmService.createClient(input, data.clients.length);
    setData((current) => ({
      ...current,
      clients: [...current.clients, saved],
    }));
    toast.success(`${saved.name} agregado`);
  };

  const associateWisproToConversation = async (result: WisproSearchResult) => {
    if (!selectedConversation) return;

    const { customer, invoicing } = result;

    const saved = await wisproService.associateToConversation({
      conversationId: selectedConversation.id,
      customer,
      invoicing,
      existingClientId: selectedConversation.client_id,
      conversationPhone: selectedClient?.phone ?? selectedClient?.whatsapp_id,
      whatsappId: selectedClient?.whatsapp_id,
      waName: selectedClient?.wa_name,
    });

    setData((current) => {
      const clientExists = current.clients.some((client) => client.id === saved.id);

      return {
        ...current,
        clients: clientExists
          ? current.clients.map((client) =>
              client.id === saved.id ? saved : client,
            )
          : [...current.clients, saved],
        conversations: current.conversations.map((conversation) =>
          conversation.id === selectedConversation.id
            ? { ...conversation, client_id: saved.id }
            : conversation,
        ),
      };
    });

    setWisproSnapshotsByClientId((current) => ({
      ...current,
      [saved.id]: customer,
    }));

    toast.success(`${saved.name} asociado a la conversación`);
  };

  const createTicket = async (input: CreateTicketInput) => {
    const saved = await crmService.createTicket(input);
    setData((current) => ({
      ...current,
      tickets: [saved, ...current.tickets],
    }));
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

  const createQuickReply = async (input: CreateQuickReplyInput) => {
    if (!agent) throw new Error("Debes iniciar sesión para crear respuestas rápidas");
    if (!isAdminRole(agent.role)) {
      throw new Error("Solo un administrador puede crear respuestas rápidas");
    }

    const saved = await crmService.createQuickReply(input, agent.id);
    setData((current) => ({
      ...current,
      quickReplies: [...current.quickReplies, saved].sort((left, right) =>
        left.title.localeCompare(right.title, "es"),
      ),
    }));
    toast.success(`"${saved.title}" creada`);
  };

  const updateQuickReply = async (quickReplyId: number, input: UpdateQuickReplyInput) => {
    if (!agent) throw new Error("Debes iniciar sesión para actualizar respuestas rápidas");
    if (!isAdminRole(agent.role)) {
      throw new Error("Solo un administrador puede editar respuestas rápidas");
    }

    const saved = await crmService.updateQuickReply(quickReplyId, input);
    setData((current) => ({
      ...current,
      quickReplies: current.quickReplies
        .map((item) => (item.id === quickReplyId ? saved : item))
        .sort((left, right) => left.title.localeCompare(right.title, "es")),
    }));
    toast.success(`"${saved.title}" actualizada`);
  };

  const toggleQuickReplyStatus = async (quickReply: QuickReply) => {
    if (!agent) throw new Error("Debes iniciar sesión para actualizar respuestas rápidas");
    if (!isAdminRole(agent.role)) {
      throw new Error("Solo un administrador puede editar respuestas rápidas");
    }

    const saved = await crmService.toggleQuickReplyStatus(
      quickReply.id,
      !quickReply.is_active,
    );

    setData((current) => ({
      ...current,
      quickReplies: current.quickReplies.map((item) =>
        item.id === quickReply.id ? saved : item,
      ),
    }));

    toast.info(
      saved.is_active
        ? `Respuesta "${saved.title}" activada`
        : `Respuesta "${saved.title}" desactivada`,
    );
  };

  const deleteQuickReply = async (quickReply: QuickReply) => {
    if (!agent) throw new Error("Debes iniciar sesión para eliminar respuestas rápidas");
    if (!isAdminRole(agent.role)) {
      throw new Error("Solo un administrador puede eliminar respuestas rápidas");
    }

    await crmService.deleteQuickReply(quickReply.id);
    setData((current) => ({
      ...current,
      quickReplies: current.quickReplies.filter((item) => item.id !== quickReply.id),
    }));
    toast.warning(`"${quickReply.title}" eliminada`);
  };

  const upsertAgent = async (input: UpsertAgentInput) => {
    await crmService.upsertAgent(input, data.agents.length);
    await loadData();
    toast.success(input.id ? "Agente actualizado" : "Agente creado");
  };

  const toggleAgentStatus = async (targetAgent: Agent) => {
    const nextStatus =
      targetAgent.status === "inactive" ? "offline" : "inactive";
    await crmService.updateAgentStatus(targetAgent.id, nextStatus);
    await loadData();
    toast.info(
      nextStatus === "inactive" ? "Agente desactivado" : "Agente activado",
    );
  };

  const labelsById = useMemo(
    () => new Map<number, Label>(data.labels.map((label) => [label.id, label])),
    [data.labels],
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
    selectedWisproSnapshot,
    selectedConversationId,
    filteredConversations,
    conversationFilterCounts,
    myAssignedConversations,
    filteredMyAssignedConversations,
    myActiveAssignedCount,
    myAssignedSearchTerm,
    myAssignedIncludeResolved,
    setMyAssignedSearchTerm,
    setMyAssignedIncludeResolved,
    clientsById,
    labelsById,
    ticketsByClientId,
    isLoading,
    isMessagesLoading,
    isSendingMessage,
    isResolvingConversation,
    searchTerm,
    conversationFilter,
    selectedLabelId,
    setSearchTerm,
    setConversationFilter,
    setSelectedLabelId,
    loadData,
    selectConversation,
    sendMessage,
    sendVoiceNote,
    sendImageMessage,
    addNote,
    takeControl,
    reactivateBot,
    resolveConversation,
    updateLabels,
    quickToggleLabel,
    assignAgent,
    createClient,
    associateWisproToConversation,
    createTicket,
    createLabel,
    deleteLabel,
    createQuickReply,
    updateQuickReply,
    toggleQuickReplyStatus,
    deleteQuickReply,
    upsertAgent,
    toggleAgentStatus,
  };
};
