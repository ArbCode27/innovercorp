"use client";

import { useState } from "react";
import { LoadingState } from "../shared/loading-state";
import { CrmLogin } from "../auth/crm-login";
import { useCrmAuth } from "../../_hooks/use-crm-auth";
import { useCrmData } from "../../_hooks/use-crm-data";
import type { CrmView } from "../../_lib/types";
import { AgentsView } from "../agents/agents-view";
import { ClientsView } from "../clients/clients-view";
import { ConversationsView } from "../conversations/conversations-view";
import { LabelsView } from "../labels/labels-view";
import { TicketsView } from "../tickets/tickets-view";
import { CrmHeader } from "./crm-header";
import { CrmSidebar } from "./crm-sidebar";

export const CrmShell = () => {
  const [activeView, setActiveView] = useState<CrmView>("conversations");
  const auth = useCrmAuth();
  const crm = useCrmData(auth.agent);

  if (auth.isLoading) {
    return (
      <main className="min-h-screen bg-[#0f1117] text-slate-100">
        <LoadingState label="Preparando CRM..." />
      </main>
    );
  }

  if (!auth.agent) {
    return <CrmLogin isSubmitting={auth.isSubmitting} onLogin={auth.login} />;
  }

  const handleSelectView = (view: CrmView) => setActiveView(view);

  return (
    <main className="flex h-screen overflow-hidden bg-[#0f1117] text-slate-100">
      <CrmSidebar
        agent={auth.agent}
        activeView={activeView}
        onSelectView={handleSelectView}
        onToggleStatus={auth.updateStatus}
      />
      <div className="flex min-w-0 flex-1 flex-col">
        <CrmHeader activeView={activeView} agent={auth.agent} onLogout={auth.logout} />
        {crm.isLoading ? (
          <LoadingState label="Conectando con Supabase..." />
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
                selectedConversationId={crm.selectedConversationId}
                isMessagesLoading={crm.isMessagesLoading}
                isSendingMessage={crm.isSendingMessage}
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
              />
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
