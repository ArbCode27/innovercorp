"use client";

import { FormEvent, useState } from "react";
import { toast } from "sonner";
import { CrmButton } from "../shared/crm-button";
import {
  Dialog,
  DialogContent,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import {
  Sheet,
  SheetContent,
  SheetDescription,
  SheetHeader,
  SheetTitle,
} from "@/components/ui/sheet";
import { Textarea } from "@/components/ui/textarea";
import { CRM_DIALOG, CRM_SURFACES } from "../../_lib/crm-theme";
import type { Agent, Client, Conversation, Label, Message, Ticket, WisproCustomer, WisproSearchResult } from "../../_lib/types";
import { AssignAgentDialog } from "../agents/assign-agent-dialog";
import { LabelPickerDialog } from "../labels/label-picker-dialog";
import { UnknownClientBanner } from "../wispro/unknown-client-banner";
import { WisproSearchDialog } from "../wispro/wispro-search-dialog";
import { ResolveConversationDialog } from "./resolve-conversation-dialog";
import { ConversationDetails } from "./conversation-details";
import { ConversationHeader } from "./conversation-header";
import { ConversationMessages } from "./conversation-messages";
import { ConversationWelcomePanel } from "./conversation-welcome-panel";
import { MessageComposer } from "./message-composer";

interface ConversationPanelProps {
  conversation: Conversation | null;
  client: Client | null;
  wisproSnapshot?: WisproCustomer | null;
  labels: Label[];
  allLabels: Label[];
  messages: Message[];
  agents: Agent[];
  conversations: Conversation[];
  currentAgent: Agent;
  tickets: Ticket[];
  isMessagesLoading: boolean;
  isSendingMessage: boolean;
  isResolvingConversation?: boolean;
  onBackToList?: () => void;
  onSendMessage: (content: string) => Promise<void>;
  onSendVoiceNote: (
    audioBlob: Blob,
    meta: { durationMs: number; mimeType: string },
  ) => Promise<void>;
  onAddNote: (content: string) => Promise<void>;
  onTakeControl: () => Promise<void>;
  onReactivateBot: () => Promise<void>;
  onResolve: () => Promise<void>;
  onUpdateLabels: (labelIds: number[]) => Promise<void>;
  onQuickToggleLabel: (labelId: number) => Promise<void>;
  onAssignAgent: (conversationId: number, agentId: number) => Promise<void>;
  onAssociateWispro: (result: WisproSearchResult) => Promise<void>;
}

export const ConversationPanel = ({
  conversation,
  client,
  wisproSnapshot,
  labels,
  allLabels,
  messages,
  agents,
  conversations,
  currentAgent,
  tickets,
  isMessagesLoading,
  isSendingMessage,
  isResolvingConversation = false,
  onBackToList,
  onSendMessage,
  onSendVoiceNote,
  onAddNote,
  onTakeControl,
  onReactivateBot,
  onResolve,
  onUpdateLabels,
  onQuickToggleLabel,
  onAssignAgent,
  onAssociateWispro,
}: ConversationPanelProps) => {
  const [isLabelDialogOpen, setIsLabelDialogOpen] = useState(false);
  const [isNoteDialogOpen, setIsNoteDialogOpen] = useState(false);
  const [isAssignDialogOpen, setIsAssignDialogOpen] = useState(false);
  const [isWisproDialogOpen, setIsWisproDialogOpen] = useState(false);
  const [isResolveDialogOpen, setIsResolveDialogOpen] = useState(false);
  const [isDetailsSheetOpen, setIsDetailsSheetOpen] = useState(false);
  const [note, setNote] = useState("");

  const clientDisplayName = client?.name || "Número desconocido";

  if (!conversation) {
    return (
      <ConversationWelcomePanel
        conversations={conversations}
        labels={allLabels}
        currentAgent={currentAgent}
      />
    );
  }

  const handleSendMessage = async (content: string) => {
    try {
      await onSendMessage(content);
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "No se pudo enviar el mensaje");
      throw error;
    }
  };

  const handleSubmitNote = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    const content = note.trim();
    if (!content) return;

    await onAddNote(content);
    setNote("");
    setIsNoteDialogOpen(false);
  };

  const handleAssignAgent = async (agentId: number) => {
    await onAssignAgent(conversation.id, agentId);
  };

  const handleAssociateWispro = async (result: WisproSearchResult) => {
    await onAssociateWispro(result);
  };

  const handleSendVoiceNote = async (
    audioBlob: Blob,
    meta: { durationMs: number; mimeType: string },
  ) => {
    try {
      await onSendVoiceNote(audioBlob, meta);
    } catch (error) {
      toast.error(
        error instanceof Error
          ? error.message
          : "No se pudo enviar la nota de voz",
      );
      throw error;
    }
  };

  const showUnknownBanner = !client;
  const showWisproAction = !client || !client.wispro_id;

  return (
    <section className={`relative flex min-w-0 flex-1 ${CRM_SURFACES.page}`}>
      <div className="flex min-w-0 flex-1 flex-col">
        <ConversationHeader
          conversation={conversation}
          client={client}
          labels={labels}
          currentAgent={currentAgent}
          onOpenDetails={() => setIsDetailsSheetOpen(true)}
          onBackToList={onBackToList}
          onOpenLabels={() => setIsLabelDialogOpen(true)}
          onTakeControl={onTakeControl}
          onReactivateBot={onReactivateBot}
          onResolve={() => setIsResolveDialogOpen(true)}
          isResolving={isResolvingConversation}
          onOpenNote={() => setIsNoteDialogOpen(true)}
          onOpenAssign={() => setIsAssignDialogOpen(true)}
          onOpenWispro={() => setIsWisproDialogOpen(true)}
        />
        {showUnknownBanner ? (
          <UnknownClientBanner onOpenWispro={() => setIsWisproDialogOpen(true)} />
        ) : null}
        <ConversationMessages
          messages={messages}
          isLoading={isMessagesLoading}
          agentName={`${currentAgent.name} (tú)`}
        />
        <MessageComposer
          disabled={isSendingMessage}
          readOnly={!conversation.human_mode}
          placeholder={
            conversation.human_mode
              ? "Responde como agente..."
              : "Toma control de la conversación para responder..."
          }
          onSend={handleSendMessage}
          onSendVoiceNote={handleSendVoiceNote}
        />
      </div>
      <Sheet open={isDetailsSheetOpen} onOpenChange={setIsDetailsSheetOpen}>
        <SheetContent className={`w-[88vw] p-0 sm:max-w-sm ${CRM_SURFACES.border} ${CRM_SURFACES.elevated} ${CRM_SURFACES.textPrimary}`}>
          <SheetHeader className={`border-b p-4 text-left ${CRM_SURFACES.border}`}>
            <SheetTitle className={CRM_SURFACES.textPrimary}>Ficha de conversación</SheetTitle>
            <SheetDescription className={CRM_SURFACES.textMuted}>
              Cliente, etiquetas, tickets y agentes disponibles.
            </SheetDescription>
          </SheetHeader>
          <ConversationDetails
            conversation={conversation}
            client={client}
            wisproSnapshot={wisproSnapshot}
            labels={allLabels}
            tickets={tickets}
            agents={agents}
            className="block h-full w-full border-l-0 bg-transparent lg:hidden"
            onToggleLabel={onQuickToggleLabel}
            onOpenWispro={showWisproAction ? () => setIsWisproDialogOpen(true) : undefined}
          />
        </SheetContent>
      </Sheet>
      <ConversationDetails
        conversation={conversation}
        client={client}
        wisproSnapshot={wisproSnapshot}
        labels={allLabels}
        tickets={tickets}
        agents={agents}
        onToggleLabel={onQuickToggleLabel}
        onOpenWispro={showWisproAction ? () => setIsWisproDialogOpen(true) : undefined}
      />

      <WisproSearchDialog
        open={isWisproDialogOpen}
        onOpenChange={setIsWisproDialogOpen}
        onAssociate={handleAssociateWispro}
      />

      <LabelPickerDialog
        open={isLabelDialogOpen}
        labels={allLabels}
        selectedLabelIds={conversation.label_ids}
        onOpenChange={setIsLabelDialogOpen}
        onSave={onUpdateLabels}
      />

      <AssignAgentDialog
        open={isAssignDialogOpen}
        agents={agents}
        conversations={conversations}
        onOpenChange={setIsAssignDialogOpen}
        onAssign={handleAssignAgent}
      />

      <ResolveConversationDialog
        open={isResolveDialogOpen}
        onOpenChange={setIsResolveDialogOpen}
        clientName={clientDisplayName}
        isSubmitting={isResolvingConversation}
        onConfirm={onResolve}
      />

      <Dialog open={isNoteDialogOpen} onOpenChange={setIsNoteDialogOpen}>
        <DialogContent className={CRM_DIALOG}>
          <form onSubmit={handleSubmitNote}>
            <DialogHeader>
              <DialogTitle>Nota interna</DialogTitle>
            </DialogHeader>
            <Textarea
              value={note}
              onChange={(event) => setNote(event.target.value)}
              placeholder="Solo visible para agentes"
              className={`mt-4 min-h-28 ${CRM_SURFACES.border} ${CRM_SURFACES.input} ${CRM_SURFACES.textPrimary}`}
            />
            <DialogFooter className="mt-4">
              <CrmButton
                type="button"
                variant="secondary"
                onClick={() => setIsNoteDialogOpen(false)}>
                Cancelar
              </CrmButton>
              <CrmButton type="submit">Agregar nota</CrmButton>
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>
    </section>
  );
};
