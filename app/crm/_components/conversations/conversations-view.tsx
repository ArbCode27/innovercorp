"use client";

import type { ConversationFilterCounts } from "../../_lib/conversation-filter-utils";
import type { Agent, Client, Conversation, ConversationFilter, Label, Message, Ticket, WisproCustomer, WisproSearchResult } from "../../_lib/types";
import { CRM_SURFACES } from "../../_lib/crm-theme";
import { ConversationFilters } from "./conversation-filters";
import { ConversationList } from "./conversation-list";
import { ConversationPanel } from "./conversation-panel";

interface ConversationsViewProps {
  currentAgent: Agent;
  conversations: Conversation[];
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
  conversationFilter: ConversationFilter;
  conversationFilterCounts: ConversationFilterCounts;
  selectedLabelId: number | null;
  onSearchChange: (value: string) => void;
  onFilterChange: (value: ConversationFilter) => void;
  onLabelFilterChange: (value: number | null) => void;
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

export const ConversationsView = ({
  currentAgent,
  conversations,
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
  conversationFilter,
  conversationFilterCounts,
  selectedLabelId,
  onSearchChange,
  onFilterChange,
  onLabelFilterChange,
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
}: ConversationsViewProps) => {
  const selectedLabels = selectedConversation
    ? selectedConversation.label_ids
        .map((id) => labelsById.get(id))
        .filter((label): label is Label => Boolean(label))
    : [];
  const selectedTickets =
    selectedConversation?.client_id
      ? ticketsByClientId.get(selectedConversation.client_id) || []
      : [];

  return (
    <div className="flex min-h-0 flex-1">
      <aside className={`flex w-80 shrink-0 flex-col border-r ${CRM_SURFACES.border} ${CRM_SURFACES.elevated}`}>
        <div className={`border-b p-4 ${CRM_SURFACES.border}`}>
          <h2 className={`text-sm font-semibold ${CRM_SURFACES.textPrimary}`}>Conversaciones</h2>
          <p className={`mt-1 text-xs ${CRM_SURFACES.textMuted}`}>
            {filteredConversations.length} de {conversationFilterCounts.all}
          </p>
        </div>
        <ConversationFilters
          searchTerm={searchTerm}
          filter={conversationFilter}
          counts={conversationFilterCounts}
          labels={labels}
          selectedLabelId={selectedLabelId}
          onSearchChange={onSearchChange}
          onFilterChange={onFilterChange}
          onLabelChange={onLabelFilterChange}
        />
        <ConversationList
          conversations={filteredConversations}
          clientsById={clientsById}
          labelsById={labelsById}
          selectedConversationId={selectedConversationId}
          onSelect={onSelectConversation}
        />
      </aside>
      <ConversationPanel
        conversation={selectedConversation}
        client={selectedClient}
        wisproSnapshot={selectedWisproSnapshot}
        labels={selectedLabels}
        allLabels={labels}
        messages={messages}
        agents={agents}
        conversations={conversations}
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
