"use client";

import { useMemo, useState } from "react";
import { CheckSquare, Inbox } from "lucide-react";
import type { CrmWisproCaso } from "@/lib/crm-wispro-casos";
import { openCasosForConversation } from "@/lib/ticket-chat-link";
import type {
  Agent,
  Client,
  Conversation,
  CrmView,
  Label,
  Message,
  QuickReply,
  WisproCustomer,
  WisproSearchResult,
} from "../../_lib/types";
import { CRM_PANEL, CRM_SURFACES } from "../../_lib/crm-theme";
import { Button } from "@/components/ui/button";
import { EmptyState } from "../shared/empty-state";
import { CrmMobileSettingsMenu } from "../shell/crm-mobile-settings-menu";
import { CrmThemeToggle } from "../shell/crm-theme-toggle";
import { BulkBotDialog } from "./bulk-bot-dialog";
import { BulkConversationsToolbar } from "./bulk-conversations-toolbar";
import { BulkLabelsDialog } from "./bulk-labels-dialog";
import { BulkReassignDialog } from "./bulk-reassign-dialog";
import { BulkResolveDialog } from "./bulk-resolve-dialog";
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
  quickReplies: QuickReply[];
  agents: Agent[];
  openCasos: CrmWisproCaso[];
  messages: Message[];
  selectedConversation: Conversation | null;
  selectedClient: Client | null;
  selectedWisproSnapshot: WisproCustomer | null;
  selectedConversationId: number | null;
  isMessagesLoading: boolean;
  isSendingMessage: boolean;
  isResolvingConversation?: boolean;
  isBulkProcessing?: boolean;
  searchTerm: string;
  includeResolved: boolean;
  selectedLabelId: number | null;
  onSearchChange: (value: string) => void;
  onIncludeResolvedChange: (value: boolean) => void;
  onLabelFilterChange: (value: number | null) => void;
  onSelectConversation: (id: number | null) => void;
  onSendMessage: (content: string) => Promise<void>;
  onSendVoiceNote: (
    audioBlob: Blob,
    meta: { durationMs: number; mimeType: string },
  ) => Promise<void>;
  onSendImage: (imageFile: File, caption?: string) => Promise<void>;
  onProcessPaymentReceipt: (messageId: number) => Promise<void>;
  onManualPaymentSuccess?: (info: {
    messageId: number;
    paymentId: string;
    amountUsd: number;
    amountBs?: number;
    bank: string;
    transactionCode: string;
    registeredInWispro: boolean;
  }) => void;
  onResendMessage: (messageId: number) => Promise<void>;
  onAddNote: (content: string) => Promise<void>;
  onTakeControl: () => Promise<void>;
  onReactivateBot: () => Promise<void>;
  onResolve: () => Promise<void>;
  onUpdateLabels: (labelIds: number[]) => Promise<void>;
  onQuickToggleLabel: (labelId: number) => Promise<void>;
  onAssignAgent: (conversationId: number, agentId: number) => Promise<void>;
  onAssociateWispro: (result: WisproSearchResult) => Promise<void>;
  onUnlinkWispro: () => Promise<void>;
  onCreatePaymentPromise: () => Promise<void>;
  onCasoCreated?: () => void;
  onOpenSettingsView: (view: CrmView) => void;
  onBulkResolve?: (
    conversationIds: number[],
  ) => Promise<{ succeeded: number; failed: number }>;
  onBulkReactivateBot?: (conversationIds: number[]) => Promise<void>;
  onBulkUpdateLabels?: (
    conversationIds: number[],
    action: "add" | "remove" | "replace",
    targetLabelIds: number[],
  ) => Promise<void>;
  onBulkAssignAgent?: (
    conversationIds: number[],
    agentId: number | null,
  ) => Promise<void>;
}

export const MyConversationsView = ({
  currentAgent,
  assignedConversations,
  filteredConversations,
  clientsById,
  labelsById,
  labels,
  quickReplies,
  agents,
  openCasos,
  messages,
  selectedConversation,
  selectedClient,
  selectedWisproSnapshot,
  selectedConversationId,
  isMessagesLoading,
  isSendingMessage,
  isResolvingConversation,
  isBulkProcessing,
  searchTerm,
  includeResolved,
  selectedLabelId,
  onSearchChange,
  onIncludeResolvedChange,
  onLabelFilterChange,
  onSelectConversation,
  onSendMessage,
  onSendVoiceNote,
  onSendImage,
  onProcessPaymentReceipt,
  onManualPaymentSuccess,
  onResendMessage,
  onAddNote,
  onTakeControl,
  onReactivateBot,
  onResolve,
  onUpdateLabels,
  onQuickToggleLabel,
  onAssignAgent,
  onAssociateWispro,
  onUnlinkWispro,
  onCreatePaymentPromise,
  onCasoCreated,
  onOpenSettingsView,
  onBulkResolve,
  onBulkReactivateBot,
  onBulkUpdateLabels,
  onBulkAssignAgent,
}: MyConversationsViewProps) => {
  const [isSelectionMode, setIsSelectionMode] = useState(false);
  const [selectedConversationIds, setSelectedConversationIds] = useState<Set<number>>(
    new Set(),
  );
  const [isBulkResolveOpen, setIsBulkResolveOpen] = useState(false);
  const [isBulkLabelsOpen, setIsBulkLabelsOpen] = useState(false);
  const [isBulkBotOpen, setIsBulkBotOpen] = useState(false);
  const [isBulkReassignOpen, setIsBulkReassignOpen] = useState(false);

  const selectedOpenCasos = selectedConversation
    ? openCasosForConversation(selectedConversation, openCasos)
    : [];

  const scopeConversations = includeResolved
    ? assignedConversations
    : assignedConversations.filter(
        (conversation) => conversation.status !== "resuelto",
      );
  const isConversationOpen = selectedConversationId !== null;

  const filteredIds = useMemo(
    () => filteredConversations.map((c) => c.id),
    [filteredConversations],
  );

  const allFilteredSelected =
    filteredIds.length > 0 &&
    filteredIds.every((id) => selectedConversationIds.has(id));

  const someFilteredSelected =
    !allFilteredSelected &&
    filteredIds.some((id) => selectedConversationIds.has(id));

  const handleToggleSelectionMode = () => {
    setIsSelectionMode((prev) => {
      const next = !prev;
      if (!next) {
        setSelectedConversationIds(new Set());
      }
      return next;
    });
  };

  const handleToggleSelectConversation = (id: number) => {
    setSelectedConversationIds((prev) => {
      const next = new Set(prev);
      if (next.has(id)) {
        next.delete(id);
      } else {
        next.add(id);
      }
      return next;
    });
  };

  const handleToggleSelectAll = () => {
    if (allFilteredSelected) {
      setSelectedConversationIds(new Set());
    } else {
      setSelectedConversationIds(new Set(filteredIds));
    }
  };

  const handleClearSelection = () => {
    setSelectedConversationIds(new Set());
  };

  const handleConfirmBulkResolve = async () => {
    if (!onBulkResolve || selectedConversationIds.size === 0) return;
    const ids = Array.from(selectedConversationIds);
    await onBulkResolve(ids);
    setSelectedConversationIds(new Set());
    setIsSelectionMode(false);
  };

  const handleConfirmBulkLabels = async (
    action: "add" | "remove" | "replace",
    targetLabelIds: number[],
  ) => {
    if (!onBulkUpdateLabels || selectedConversationIds.size === 0) return;
    const ids = Array.from(selectedConversationIds);
    await onBulkUpdateLabels(ids, action, targetLabelIds);
    setSelectedConversationIds(new Set());
  };

  const handleConfirmBulkBot = async () => {
    if (!onBulkReactivateBot || selectedConversationIds.size === 0) return;
    const ids = Array.from(selectedConversationIds);
    await onBulkReactivateBot(ids);
    setSelectedConversationIds(new Set());
  };

  const handleConfirmBulkReassign = async (targetAgentId: number | null) => {
    if (!onBulkAssignAgent || selectedConversationIds.size === 0) return;
    const ids = Array.from(selectedConversationIds);
    await onBulkAssignAgent(ids, targetAgentId);
    setSelectedConversationIds(new Set());
  };

  return (
    <div className="flex min-h-0 flex-1 gap-2 md:gap-3">
      <aside
        className={`${
          isConversationOpen ? "hidden md:flex" : "flex"
        } min-h-0 w-full shrink-0 flex-col md:w-80 ${CRM_PANEL}`}>
        <div className={`border-b p-4 ${CRM_SURFACES.border}`}>
          <div className="flex items-center justify-between gap-2">
            <h2 className={`text-sm font-semibold ${CRM_SURFACES.textPrimary}`}>
              Mis asignadas
            </h2>
            <div className="flex items-center gap-1.5">
              {filteredConversations.length > 0 ? (
                <Button
                  type="button"
                  variant={isSelectionMode ? "secondary" : "ghost"}
                  size="sm"
                  onClick={handleToggleSelectionMode}
                  className="h-7 gap-1 px-2 text-xs"
                  aria-label={
                    isSelectionMode
                      ? "Salir del modo de selección múltiple"
                      : "Activar modo de selección múltiple"
                  }>
                  <CheckSquare className="size-3.5" aria-hidden="true" />
                  <span>{isSelectionMode ? "Listo" : "Seleccionar"}</span>
                </Button>
              ) : null}
              <div className="flex items-center gap-1 md:hidden">
                <CrmThemeToggle className="size-8" />
                <CrmMobileSettingsMenu onSelectView={onOpenSettingsView} />
              </div>
            </div>
          </div>
          <p className={`mt-1 text-xs ${CRM_SURFACES.textMuted}`}>
            {filteredConversations.length} de {scopeConversations.length}{" "}
            {includeResolved ? "asignadas" : "activas"}
            {selectedLabelId !== null ? " · filtro de etiqueta" : ""}
          </p>
        </div>

        {isSelectionMode ? (
          <BulkConversationsToolbar
            selectedCount={selectedConversationIds.size}
            totalCount={filteredConversations.length}
            allSelected={allFilteredSelected}
            someSelected={someFilteredSelected}
            isProcessing={Boolean(isBulkProcessing)}
            onToggleSelectAll={handleToggleSelectAll}
            onClearSelection={handleClearSelection}
            onOpenResolve={() => setIsBulkResolveOpen(true)}
            onOpenLabels={() => setIsBulkLabelsOpen(true)}
            onOpenBot={() => setIsBulkBotOpen(true)}
            onOpenReassign={() => setIsBulkReassignOpen(true)}
          />
        ) : null}

        <MyConversationsFilters
          searchTerm={searchTerm}
          includeResolved={includeResolved}
          labels={labels}
          selectedLabelId={selectedLabelId}
          onSearchChange={onSearchChange}
          onIncludeResolvedChange={onIncludeResolvedChange}
          onLabelChange={onLabelFilterChange}
        />

        {assignedConversations.length ? (
          <ConversationList
            conversations={filteredConversations}
            clientsById={clientsById}
            labelsById={labelsById}
            selectedConversationId={selectedConversationId}
            openCasos={openCasos}
            onSelect={onSelectConversation}
            isSelectionMode={isSelectionMode}
            selectedConversationIds={selectedConversationIds}
            onToggleSelect={handleToggleSelectConversation}
          />
        ) : (
          <EmptyState
            icon={Inbox}
            title="No tienes conversaciones asignadas"
            description="Cuando un administrador te asigne chats, aparecerán aquí."
          />
        )}
      </aside>

      <div
        className={`${
          isConversationOpen ? "flex" : "hidden md:flex"
        } min-h-0 min-w-0 flex-1 ${CRM_PANEL}`}>
        <ConversationPanel
          conversation={selectedConversation}
          client={selectedClient}
          wisproSnapshot={selectedWisproSnapshot}
          allLabels={labels}
          quickReplies={quickReplies}
          messages={messages}
          agents={agents}
          conversations={assignedConversations}
          currentAgent={currentAgent}
          openCasos={selectedOpenCasos}
          isMessagesLoading={isMessagesLoading}
          isSendingMessage={isSendingMessage}
          isResolvingConversation={isResolvingConversation}
          onSendMessage={onSendMessage}
          onSendVoiceNote={onSendVoiceNote}
          onSendImage={onSendImage}
          onProcessPaymentReceipt={onProcessPaymentReceipt}
          onManualPaymentSuccess={onManualPaymentSuccess}
          onResendMessage={onResendMessage}
          onBackToList={() => onSelectConversation(null)}
          onAddNote={onAddNote}
          onTakeControl={onTakeControl}
          onReactivateBot={onReactivateBot}
          onResolve={onResolve}
          onUpdateLabels={onUpdateLabels}
          onQuickToggleLabel={onQuickToggleLabel}
          onAssignAgent={onAssignAgent}
          onAssociateWispro={onAssociateWispro}
          onUnlinkWispro={onUnlinkWispro}
          onCreatePaymentPromise={onCreatePaymentPromise}
          onCasoCreated={onCasoCreated}
        />
      </div>

      <BulkResolveDialog
        open={isBulkResolveOpen}
        onOpenChange={setIsBulkResolveOpen}
        count={selectedConversationIds.size}
        isSubmitting={Boolean(isBulkProcessing)}
        onConfirm={handleConfirmBulkResolve}
      />

      <BulkLabelsDialog
        open={isBulkLabelsOpen}
        onOpenChange={setIsBulkLabelsOpen}
        count={selectedConversationIds.size}
        labels={labels}
        isSubmitting={Boolean(isBulkProcessing)}
        onConfirm={handleConfirmBulkLabels}
      />

      <BulkBotDialog
        open={isBulkBotOpen}
        onOpenChange={setIsBulkBotOpen}
        count={selectedConversationIds.size}
        isSubmitting={Boolean(isBulkProcessing)}
        onConfirm={handleConfirmBulkBot}
      />

      <BulkReassignDialog
        open={isBulkReassignOpen}
        onOpenChange={setIsBulkReassignOpen}
        count={selectedConversationIds.size}
        currentAgentId={currentAgent.id}
        agents={agents}
        isSubmitting={Boolean(isBulkProcessing)}
        onConfirm={handleConfirmBulkReassign}
      />
    </div>
  );
};
