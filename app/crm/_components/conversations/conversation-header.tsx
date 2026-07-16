"use client";

import {
  ArrowLeft,
  Check,
  FileText,
  RotateCcw,
  Search,
  Tag,
  UserCheck,
  UserPlus,
} from "lucide-react";
import type { Agent, Client, Conversation } from "../../_lib/types";
import { canAssignConversation } from "../../_lib/conversation-permissions";
import { CRM_SURFACES } from "../../_lib/crm-theme";
import { AvatarInitials } from "../shared/avatar-initials";
import { CrmButton } from "../shared/crm-button";
import { StatusBadge } from "../shared/status-badge";
import { CrmThemeToggle } from "../shell/crm-theme-toggle";
import { ConversationActionsDrawer } from "./conversation-actions-drawer";

interface ConversationHeaderProps {
  conversation: Conversation;
  client: Client | null;
  currentAgent: Agent;
  onBackToList?: () => void;
  onOpenDetails?: () => void;
  onOpenLabels: () => void;
  onTakeControl: () => void;
  onReactivateBot: () => void;
  onResolve: () => void;
  isResolving?: boolean;
  onOpenNote: () => void;
  onOpenAssign: () => void;
  onOpenWispro: () => void;
}

export const ConversationHeader = ({
  conversation,
  client,
  currentAgent,
  onBackToList,
  onOpenDetails,
  onOpenLabels,
  onTakeControl,
  onReactivateBot,
  onResolve,
  onOpenNote,
  onOpenAssign,
  onOpenWispro,
  isResolving = false,
}: ConversationHeaderProps) => {
  const displayName = client?.name || "Número desconocido";
  const phone =
    client?.phone || client?.whatsapp_id || "Sin identificar";
  const canAssignAgent = canAssignConversation(currentAgent);
  const assignLabel = conversation.human_mode
    ? "Transferir conversación"
    : "Asignar agente";
  const showWisproSearch = !client;
  const showWisproLink = Boolean(client && !client.wispro_id);

  return (
    <div
      className={`shrink-0 border-b backdrop-blur ${CRM_SURFACES.border} ${CRM_SURFACES.elevatedTranslucent}`}>
      <div className="flex flex-col gap-3 p-4 xl:flex-row xl:items-start">
        <div className="flex min-w-0 flex-1 gap-3">
          {onBackToList ? (
            <CrmButton
              type="button"
              variant="ghost"
              size="icon"
              className="md:hidden"
              onClick={onBackToList}
              aria-label="Volver a conversaciones">
              <ArrowLeft className="size-4" aria-hidden="true" />
            </CrmButton>
          ) : null}
          {onOpenDetails ? (
            <button
              type="button"
              className="rounded-full md:hidden"
              onClick={onOpenDetails}
              aria-label="Ver ficha del cliente">
              <AvatarInitials
                name={displayName}
                initials={client?.initials}
                color={client?.color || "#f5a524"}
                bg={client?.bg || "rgba(245,165,36,.15)"}
                size="lg"
              />
            </button>
          ) : null}
          <div className={onOpenDetails ? "hidden md:block" : ""}>
            <AvatarInitials
              name={displayName}
              initials={client?.initials}
              color={client?.color || "#f5a524"}
              bg={client?.bg || "rgba(245,165,36,.15)"}
              size="lg"
            />
          </div>
          <div className="min-w-0 flex-1">
            <h2 className={`truncate text-base font-semibold ${CRM_SURFACES.textPrimary}`}>
              {displayName}
            </h2>
            <div className={`mt-1 text-xs ${CRM_SURFACES.textMuted}`}>
              <span>{phone}</span>
            </div>
            <div className="mt-1 flex items-center gap-2">
              <StatusBadge status={conversation.status} />
              <StatusBadge status={conversation.human_mode ? "human" : "bot"} />
            </div>
          </div>
          <ConversationActionsDrawer
            isHumanMode={conversation.human_mode}
            isResolving={isResolving}
            canAssignAgent={canAssignAgent}
            assignLabel={assignLabel}
            showWisproSearch={showWisproSearch}
            showWisproLink={showWisproLink}
            onTakeControl={onTakeControl}
            onReactivateBot={onReactivateBot}
            onResolve={onResolve}
            onOpenLabels={onOpenLabels}
            onOpenNote={onOpenNote}
            onOpenAssign={onOpenAssign}
            onOpenWispro={onOpenWispro}
          />
          <CrmThemeToggle className="size-8 md:hidden" />
        </div>
        <div
          className="hidden shrink-0 flex-wrap items-center justify-end gap-2 md:flex"
          role="toolbar"
          aria-label="Acciones de conversación">
          {conversation.human_mode ? (
            <CrmButton type="button" variant="violet" size="sm" onClick={onReactivateBot}>
              <RotateCcw className="size-3" aria-hidden="true" />
              Reactivar bot
            </CrmButton>
          ) : (
            <CrmButton type="button" variant="danger" size="sm" onClick={onTakeControl}>
              <UserCheck className="size-3" aria-hidden="true" />
              Tomar control
            </CrmButton>
          )}
          <CrmButton
            type="button"
            variant="success"
            size="sm"
            disabled={isResolving}
            onClick={onResolve}>
            <Check className="size-3" aria-hidden="true" />
            {isResolving ? "Archivando..." : "Resolver"}
          </CrmButton>
          <CrmButton type="button" variant="secondary" size="sm" onClick={onOpenLabels}>
            <Tag className="size-3" aria-hidden="true" />
            Editar etiquetas
          </CrmButton>
          <CrmButton type="button" variant="secondary" size="sm" onClick={onOpenNote}>
            <FileText className="size-3" aria-hidden="true" />
            Agregar nota
          </CrmButton>
          {canAssignAgent ? (
            <CrmButton type="button" variant="secondary" size="sm" onClick={onOpenAssign}>
              <UserPlus className="size-3" aria-hidden="true" />
              {assignLabel}
            </CrmButton>
          ) : null}
          {showWisproSearch ? (
            <CrmButton type="button" variant="secondary" size="sm" onClick={onOpenWispro}>
              <Search className="size-3" aria-hidden="true" />
              Buscar en Wispro
            </CrmButton>
          ) : null}
          {showWisproLink ? (
            <CrmButton type="button" variant="secondary" size="sm" onClick={onOpenWispro}>
              <Search className="size-3" aria-hidden="true" />
              Wispro
            </CrmButton>
          ) : null}
        </div>
      </div>
      {conversation.human_mode ? (
        <div className="border-t border-red-300 bg-red-50 px-4 py-2 text-xs text-red-800 dark:border-red-500/30 dark:bg-red-950/50 dark:text-red-100">
          Modo agente activo: la IA está pausada mientras el equipo responde.
        </div>
      ) : null}
    </div>
  );
};
