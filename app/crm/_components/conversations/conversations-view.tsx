"use client";

import type { Agent, Client, Conversation, ConversationFilter, Label, Message, Ticket } from "../../_lib/types";
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
  selectedConversationId: number | null;
  isMessagesLoading: boolean;
  searchTerm: string;
  conversationFilter: ConversationFilter;
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
  selectedConversationId,
  isMessagesLoading,
  searchTerm,
  conversationFilter,
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
      <aside className="flex w-80 shrink-0 flex-col border-r border-white/10 bg-[#161922]">
        <div className="border-b border-white/10 p-4">
          <h2 className="text-sm font-semibold text-slate-100">Conversaciones</h2>
          <p className="mt-1 text-xs text-slate-500">
            {filteredConversations.length} de {conversations.length}
          </p>
        </div>
        <ConversationFilters
          searchTerm={searchTerm}
          filter={conversationFilter}
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
        labels={selectedLabels}
        allLabels={labels}
        messages={messages}
        agents={agents}
        conversations={conversations}
        currentAgent={currentAgent}
        tickets={selectedTickets}
        isMessagesLoading={isMessagesLoading}
        onSendMessage={onSendMessage}
        onAddNote={onAddNote}
        onTakeControl={onTakeControl}
        onReactivateBot={onReactivateBot}
        onResolve={onResolve}
        onUpdateLabels={onUpdateLabels}
        onQuickToggleLabel={onQuickToggleLabel}
        onAssignAgent={onAssignAgent}
      />
    </div>
  );
};
