"use client";

import { FormEvent, useState } from "react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Textarea } from "@/components/ui/textarea";
import type { Agent, Client, Conversation, Label, Message, Ticket } from "../../_lib/types";
import { AssignAgentDialog } from "../agents/assign-agent-dialog";
import { LabelPickerDialog } from "../labels/label-picker-dialog";
import { ConversationDetails } from "./conversation-details";
import { ConversationHeader } from "./conversation-header";
import { ConversationMessages } from "./conversation-messages";
import { ConversationWelcomePanel } from "./conversation-welcome-panel";
import { MessageComposer } from "./message-composer";

interface ConversationPanelProps {
  conversation: Conversation | null;
  client: Client | null;
  labels: Label[];
  allLabels: Label[];
  messages: Message[];
  agents: Agent[];
  conversations: Conversation[];
  currentAgent: Agent;
  tickets: Ticket[];
  isMessagesLoading: boolean;
  onSendMessage: (content: string) => Promise<void>;
  onAddNote: (content: string) => Promise<void>;
  onTakeControl: () => Promise<void>;
  onReactivateBot: () => Promise<void>;
  onResolve: () => Promise<void>;
  onUpdateLabels: (labelIds: number[]) => Promise<void>;
  onQuickToggleLabel: (labelId: number) => Promise<void>;
  onAssignAgent: (conversationId: number, agentId: number) => Promise<void>;
}

export const ConversationPanel = ({
  conversation,
  client,
  labels,
  allLabels,
  messages,
  agents,
  conversations,
  currentAgent,
  tickets,
  isMessagesLoading,
  onSendMessage,
  onAddNote,
  onTakeControl,
  onReactivateBot,
  onResolve,
  onUpdateLabels,
  onQuickToggleLabel,
  onAssignAgent,
}: ConversationPanelProps) => {
  const [isLabelDialogOpen, setIsLabelDialogOpen] = useState(false);
  const [isNoteDialogOpen, setIsNoteDialogOpen] = useState(false);
  const [isAssignDialogOpen, setIsAssignDialogOpen] = useState(false);
  const [note, setNote] = useState("");

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

  return (
    <section className="flex min-w-0 flex-1 bg-[#0f1117]">
      <div className="flex min-w-0 flex-1 flex-col">
        <ConversationHeader
          conversation={conversation}
          client={client}
          labels={labels}
          currentAgent={currentAgent}
          onOpenLabels={() => setIsLabelDialogOpen(true)}
          onTakeControl={onTakeControl}
          onReactivateBot={onReactivateBot}
          onResolve={onResolve}
          onOpenNote={() => setIsNoteDialogOpen(true)}
          onOpenAssign={() => setIsAssignDialogOpen(true)}
        />
        <ConversationMessages
          messages={messages}
          isLoading={isMessagesLoading}
          agentName={`${currentAgent.name} (tú)`}
        />
        <MessageComposer
          onSend={handleSendMessage}
          onOpenLabels={() => setIsLabelDialogOpen(true)}
          onOpenNote={() => setIsNoteDialogOpen(true)}
        />
      </div>
      <ConversationDetails
        conversation={conversation}
        client={client}
        labels={allLabels}
        tickets={tickets}
        agents={agents}
        onToggleLabel={onQuickToggleLabel}
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

      <Dialog open={isNoteDialogOpen} onOpenChange={setIsNoteDialogOpen}>
        <DialogContent className="border-white/10 bg-[#161922] text-slate-100">
          <form onSubmit={handleSubmitNote}>
            <DialogHeader>
              <DialogTitle>Nota interna</DialogTitle>
            </DialogHeader>
            <Textarea
              value={note}
              onChange={(event) => setNote(event.target.value)}
              placeholder="Solo visible para agentes"
              className="mt-4 min-h-28 border-white/10 bg-[#1d2130] text-slate-100"
            />
            <DialogFooter className="mt-4">
              <Button
                type="button"
                variant="outline"
                onClick={() => setIsNoteDialogOpen(false)}
              >
                Cancelar
              </Button>
              <Button type="submit" className="bg-blue-500">
                Agregar nota
              </Button>
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>
    </section>
  );
};
