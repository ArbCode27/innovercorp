"use client";

import { useState } from "react";
import { CRM_SURFACES } from "../../_lib/crm-theme";
import { LoadingState } from "../shared/loading-state";
import { CrmLogin } from "../auth/crm-login";
import { useCrmAuth } from "../../_hooks/use-crm-auth";
import { useCrmData } from "../../_hooks/use-crm-data";
import type { CrmView } from "../../_lib/types";
import { AgentsView } from "../agents/agents-view";
import { ClientsView } from "../clients/clients-view";
import { MyConversationsView } from "../conversations/my-conversations-view";
import { ConversationsView } from "../conversations/conversations-view";
import { HistoryView } from "../history/history-view";
import { LabelsView } from "../labels/labels-view";
import { TicketsView } from "../tickets/tickets-view";
import { CrmSidebar } from "./crm-sidebar";

export const CrmShell = () => {
  const [activeView, setActiveView] = useState<CrmView>("conversations");
  const auth = useCrmAuth();
  const crm = useCrmData(auth.agent);

  if (auth.isLoading) {
    return (
      <main className={`flex h-full items-center justify-center ${CRM_SURFACES.page}`}>
        <LoadingState label="Preparando CRM..." />
      </main>
    );
  }

  if (!auth.agent) {
    return <CrmLogin isSubmitting={auth.isSubmitting} onLogin={auth.login} />;
  }

  const handleSelectView = (view: CrmView) => setActiveView(view);

  return (
    <main className={`flex h-full overflow-hidden ${CRM_SURFACES.page}`}>
      <CrmSidebar
        agent={auth.agent}
        activeView={activeView}
        myAssignedCount={crm.myActiveAssignedCount}
        onSelectView={handleSelectView}
        onToggleStatus={auth.updateStatus}
        onLogout={auth.logout}
      />
      <div className="flex min-h-0 min-w-0 flex-1 flex-col overflow-hidden">
        {crm.isLoading ? (
          <div className="flex min-h-0 flex-1 items-center justify-center overflow-hidden">
            <LoadingState label="Conectando con Supabase..." />
          </div>
        ) : (
          <>
            {activeView === "conversations" ? (
              <ConversationsView
                currentAgent={auth.agent}
                conversations={crm.conversations}
                filteredConversations={crm.filteredConversations}
                clientsById={crm.clientsById}
                labelsById={crm.labelsById}
                labels={crm.labels}
                agents={crm.agents}
                ticketsByClientId={crm.ticketsByClientId}
                messages={crm.messages}
                selectedConversation={crm.selectedConversation}
                selectedClient={crm.selectedClient}
                selectedWisproSnapshot={crm.selectedWisproSnapshot}
                selectedConversationId={crm.selectedConversationId}
                isMessagesLoading={crm.isMessagesLoading}
                isSendingMessage={crm.isSendingMessage}
                isResolvingConversation={crm.isResolvingConversation}
                searchTerm={crm.searchTerm}
                conversationFilter={crm.conversationFilter}
                selectedLabelId={crm.selectedLabelId}
                onSearchChange={crm.setSearchTerm}
                onFilterChange={crm.setConversationFilter}
                onLabelFilterChange={crm.setSelectedLabelId}
                onSelectConversation={crm.selectConversation}
                onSendMessage={crm.sendMessage}
                onAddNote={crm.addNote}
                onTakeControl={crm.takeControl}
                onReactivateBot={crm.reactivateBot}
                onResolve={crm.resolveConversation}
                onUpdateLabels={crm.updateLabels}
                onQuickToggleLabel={crm.quickToggleLabel}
                onAssignAgent={crm.assignAgent}
                onAssociateWispro={crm.associateWisproToConversation}
              />
            ) : null}
            {activeView === "my-conversations" ? (
              <MyConversationsView
                currentAgent={auth.agent}
                assignedConversations={crm.myAssignedConversations}
                filteredConversations={crm.filteredMyAssignedConversations}
                clientsById={crm.clientsById}
                labelsById={crm.labelsById}
                labels={crm.labels}
                agents={crm.agents}
                ticketsByClientId={crm.ticketsByClientId}
                messages={crm.messages}
                selectedConversation={crm.selectedConversation}
                selectedClient={crm.selectedClient}
                selectedWisproSnapshot={crm.selectedWisproSnapshot}
                selectedConversationId={crm.selectedConversationId}
                isMessagesLoading={crm.isMessagesLoading}
                isSendingMessage={crm.isSendingMessage}
                isResolvingConversation={crm.isResolvingConversation}
                searchTerm={crm.myAssignedSearchTerm}
                includeResolved={crm.myAssignedIncludeResolved}
                onSearchChange={crm.setMyAssignedSearchTerm}
                onIncludeResolvedChange={crm.setMyAssignedIncludeResolved}
                onSelectConversation={crm.selectConversation}
                onSendMessage={crm.sendMessage}
                onAddNote={crm.addNote}
                onTakeControl={crm.takeControl}
                onReactivateBot={crm.reactivateBot}
                onResolve={crm.resolveConversation}
                onUpdateLabels={crm.updateLabels}
                onQuickToggleLabel={crm.quickToggleLabel}
                onAssignAgent={crm.assignAgent}
                onAssociateWispro={crm.associateWisproToConversation}
              />
            ) : null}
            {activeView === "history" ? (
              <HistoryView agents={crm.agents} labels={crm.labels} />
            ) : null}
            {activeView === "clients" ? (
              <ClientsView
                clients={crm.clients}
                tickets={crm.tickets}
                onCreateClient={crm.createClient}
              />
            ) : null}
            {activeView === "tickets" ? (
              <TicketsView
                tickets={crm.tickets}
                clients={crm.clients}
                clientsById={crm.clientsById}
                agents={crm.agents}
                onCreateTicket={crm.createTicket}
              />
            ) : null}
            {activeView === "labels" ? (
              <LabelsView
                labels={crm.labels}
                conversations={crm.conversations}
                onCreateLabel={crm.createLabel}
                onDeleteLabel={crm.deleteLabel}
              />
            ) : null}
            {activeView === "agents" ? (
              <AgentsView
                currentAgent={auth.agent}
                agents={crm.agents}
                conversations={crm.conversations}
                onSaveAgent={crm.upsertAgent}
                onToggleAgentStatus={crm.toggleAgentStatus}
              />
            ) : null}
          </>
        )}
      </div>
    </main>
  );
};
