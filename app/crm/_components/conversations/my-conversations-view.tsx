"use client";

import { Inbox } from "lucide-react";
import type {
  Agent,
  Client,
  Conversation,
  Label,
  Message,
  Ticket,
  WisproCustomer,
  WisproSearchResult,
} from "../../_lib/types";
import { CRM_SURFACES } from "../../_lib/crm-theme";
import { EmptyState } from "../shared/empty-state";
import { ConversationList } from "./conversation-list";
import { ConversationPanel } from "./conversation-panel";
import { MyConversationsFilters } from "./my-conversations-filters";

interface MyConversationsViewProps {
  currentAgent: Agent;
  assignedConversations: Conversation[];
  filteredConversations: Conversation[];
  clientsById: Map<number, Client>;
  labelsById: Map<number, Label>;
  labels: Label[];
  agents: Agent[];
  ticketsByClientId: Map<number, Ticket[]>;
  messages: Message[];
  selectedConversation: Conversation | null;
  selectedClient: Client | null;
  selectedWisproSnapshot: WisproCustomer | null;
  selectedConversationId: number | null;
  isMessagesLoading: boolean;
  isSendingMessage: boolean;
  isResolvingConversation?: boolean;
  searchTerm: string;
  includeResolved: boolean;
  onSearchChange: (value: string) => void;
  onIncludeResolvedChange: (value: boolean) => void;
  onSelectConversation: (id: number) => void;
  onSendMessage: (content: string) => Promise<void>;
  onAddNote: (content: string) => Promise<void>;
  onTakeControl: () => Promise<void>;
  onReactivateBot: () => Promise<void>;
  onResolve: () => Promise<void>;
  onUpdateLabels: (labelIds: number[]) => Promise<void>;
  onQuickToggleLabel: (labelId: number) => Promise<void>;
  onAssignAgent: (conversationId: number, agentId: number) => Promise<void>;
  onAssociateWispro: (result: WisproSearchResult) => Promise<void>;
}

export const MyConversationsView = ({
  currentAgent,
  assignedConversations,
  filteredConversations,
  clientsById,
  labelsById,
  labels,
  agents,
  ticketsByClientId,
  messages,
  selectedConversation,
  selectedClient,
  selectedWisproSnapshot,
  selectedConversationId,
  isMessagesLoading,
  isSendingMessage,
  isResolvingConversation,
  searchTerm,
  includeResolved,
  onSearchChange,
  onIncludeResolvedChange,
  onSelectConversation,
  onSendMessage,
  onAddNote,
  onTakeControl,
  onReactivateBot,
  onResolve,
  onUpdateLabels,
  onQuickToggleLabel,
  onAssignAgent,
  onAssociateWispro,
}: MyConversationsViewProps) => {
  const selectedLabels = selectedConversation
    ? selectedConversation.label_ids
        .map((id) => labelsById.get(id))
        .filter((label): label is Label => Boolean(label))
    : [];
  const selectedTickets =
    selectedConversation?.client_id
      ? ticketsByClientId.get(selectedConversation.client_id) || []
      : [];

  const activeCount = assignedConversations.filter(
    (conversation) => conversation.status !== "resuelto",
  ).length;

  return (
    <div className="flex min-h-0 flex-1">
      <aside
        className={`flex w-80 shrink-0 flex-col border-r ${CRM_SURFACES.border} ${CRM_SURFACES.elevated}`}>
        <div className={`border-b p-4 ${CRM_SURFACES.border}`}>
          <h2 className={`text-sm font-semibold ${CRM_SURFACES.textPrimary}`}>
            Mis asignadas
          </h2>
          <p className={`mt-1 text-xs ${CRM_SURFACES.textMuted}`}>
            {filteredConversations.length} de {assignedConversations.length}{" "}
            asignadas
            {!includeResolved && activeCount !== assignedConversations.length
              ? ` · ${activeCount} activas`
              : ""}
          </p>
        </div>

        <MyConversationsFilters
          searchTerm={searchTerm}
          includeResolved={includeResolved}
          onSearchChange={onSearchChange}
          onIncludeResolvedChange={onIncludeResolvedChange}
        />

        {assignedConversations.length ? (
          <ConversationList
            conversations={filteredConversations}
            clientsById={clientsById}
            labelsById={labelsById}
            selectedConversationId={selectedConversationId}
            onSelect={onSelectConversation}
          />
        ) : (
          <EmptyState
            icon={Inbox}
            title="No tienes conversaciones asignadas"
            description="Cuando un administrador te asigne chats, aparecerán aquí."
          />
        )}
      </aside>

      <ConversationPanel
        conversation={selectedConversation}
        client={selectedClient}
        wisproSnapshot={selectedWisproSnapshot}
        labels={selectedLabels}
        allLabels={labels}
        messages={messages}
        agents={agents}
        conversations={assignedConversations}
        currentAgent={currentAgent}
        tickets={selectedTickets}
        isMessagesLoading={isMessagesLoading}
        isSendingMessage={isSendingMessage}
        isResolvingConversation={isResolvingConversation}
        onSendMessage={onSendMessage}
        onAddNote={onAddNote}
        onTakeControl={onTakeControl}
        onReactivateBot={onReactivateBot}
        onResolve={onResolve}
        onUpdateLabels={onUpdateLabels}
        onQuickToggleLabel={onQuickToggleLabel}
        onAssignAgent={onAssignAgent}
        onAssociateWispro={onAssociateWispro}
      />
    </div>
  );
};
