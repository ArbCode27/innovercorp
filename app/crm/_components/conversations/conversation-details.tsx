"use client";

import { cn } from "@/lib/utils";
import { CRM_SURFACES } from "../../_lib/crm-theme";
import type { CrmWisproCaso } from "@/lib/crm-wispro-casos";
import type {
  Agent,
  Client,
  Conversation,
  Label,
  WisproCustomer,
} from "../../_lib/types";
import { casoStatusLabels } from "../../_lib/wispro-caso-schema";
import { formatCrmDate } from "../../_lib/formatters";
import { AvatarInitials } from "../shared/avatar-initials";
import { Button } from "@/components/ui/button";
import { LabelChip } from "../shared/label-chip";
import { ClientProfileSection } from "./client-profile-section";

interface ConversationDetailsProps {
  conversation: Conversation;
  client: Client | null;
  wisproSnapshot?: WisproCustomer | null;
  labels: Label[];
  openCasos: CrmWisproCaso[];
  agents: Agent[];
  className?: string;
  onToggleLabel: (labelId: number) => Promise<void>;
  onOpenWispro?: () => void;
  onUnlinkWispro?: () => void;
  isUnlinkingWispro?: boolean;
  onCreatePaymentPromise?: () => void;
  isCreatingPaymentPromise?: boolean;
  onOpenCreateCaso?: () => void;
}

export const ConversationDetails = ({
  conversation,
  client,
  wisproSnapshot,
  labels,
  openCasos,
  agents,
  className,
  onToggleLabel,
  onOpenWispro,
  onUnlinkWispro,
  isUnlinkingWispro = false,
  onCreatePaymentPromise,
  isCreatingPaymentPromise = false,
  onOpenCreateCaso,
}: ConversationDetailsProps) => {
  const onlineAgents = agents.filter(
    (agent) => agent.status === "online" || agent.status === "busy",
  );

  return (
    <aside
      className={cn(
        `crm-scrollbar hidden w-72 shrink-0 overflow-y-auto border-l bg-white/25 dark:bg-white/[.03] lg:block ${CRM_SURFACES.border}`,
        className,
      )}>
      <section className={`space-y-4 border-b p-4 ${CRM_SURFACES.border}`}>
        <h3 className={`text-[11px] font-semibold uppercase tracking-wide ${CRM_SURFACES.textMuted}`}>
          Ficha del cliente
        </h3>
        {client ? (
          <ClientProfileSection
            client={client}
            wisproSnapshot={wisproSnapshot}
            onOpenWispro={onOpenWispro}
            onUnlinkWispro={onUnlinkWispro}
            isUnlinkingWispro={isUnlinkingWispro}
            onCreatePaymentPromise={onCreatePaymentPromise}
            isCreatingPaymentPromise={isCreatingPaymentPromise}
          />
        ) : (
          <div className="space-y-3">
            <p className="text-sm text-amber-700 dark:text-amber-300">
              Número desconocido. Busca al cliente por cédula o nombre para asociarlo a esta
              conversación.
            </p>
            {onOpenWispro ? (
              <Button type="button" variant="secondary" size="sm" onClick={onOpenWispro}>
                Buscar cliente
              </Button>
            ) : null}
          </div>
        )}
      </section>

      <section className={`space-y-3 border-b p-4 ${CRM_SURFACES.border}`}>
        <h3 className={`text-[11px] font-semibold uppercase tracking-wide ${CRM_SURFACES.textMuted}`}>
          Etiquetas
        </h3>
        {labels.length ? (
          <div className="flex flex-wrap gap-2">
            {labels.map((label) => (
              <LabelChip
                key={label.id}
                label={label}
                selected={conversation.label_ids.includes(label.id)}
                className={
                  conversation.label_ids.includes(label.id)
                    ? "opacity-100"
                    : "opacity-45"
                }
                onClick={() => void onToggleLabel(label.id)}
              />
            ))}
          </div>
        ) : (
          <p className={`text-xs ${CRM_SURFACES.textLabel}`}>
            No hay etiquetas creadas.
          </p>
        )}
      </section>

      <section className={`space-y-3 border-b p-4 ${CRM_SURFACES.border}`}>
        <h3 className={`text-[11px] font-semibold uppercase tracking-wide ${CRM_SURFACES.textMuted}`}>
          Ticket activo
        </h3>
        {openCasos.length ? (
          <div className="space-y-3">
            {openCasos.map((caso) => (
              <div key={caso.wisproIssueId} className="space-y-1.5">
                <p className={`font-mono text-sm ${CRM_SURFACES.textPrimary}`}>
                  {caso.wisproPublicId != null ? `#${caso.wisproPublicId}` : "Ticket"}
                </p>
                <p className={`text-sm ${CRM_SURFACES.textSecondary}`}>
                  {caso.cause || caso.title}
                </p>
                <p className={`text-xs ${CRM_SURFACES.textMuted}`}>
                  {casoStatusLabels[caso.status]}
                  {caso.employeeName ? ` · ${caso.employeeName}` : " · sin asignar"}
                </p>
              </div>
            ))}
          </div>
        ) : (
          <p className={`text-xs ${CRM_SURFACES.textLabel}`}>Sin tickets activos</p>
        )}
        {onOpenCreateCaso ? (
          <Button
            type="button"
            variant="secondary"
            size="sm"
            className="mt-2 w-full"
            onClick={onOpenCreateCaso}>
            Crear ticket
          </Button>
        ) : null}
      </section>

      <section className={`space-y-3 border-b p-4 ${CRM_SURFACES.border}`}>
        <h3 className={`text-[11px] font-semibold uppercase tracking-wide ${CRM_SURFACES.textMuted}`}>
          Agentes en línea
        </h3>
        {onlineAgents.length ? (
          onlineAgents.map((agent) => (
            <div key={agent.id} className="flex items-center gap-2">
              <AvatarInitials
                name={agent.name}
                initials={agent.initials}
                color={agent.avatar_color}
                bg={agent.avatar_bg}
                size="sm"
              />
              <span className={`min-w-0 flex-1 truncate text-xs ${CRM_SURFACES.textSecondary}`}>
                {agent.name}
              </span>
              <span
                className={`size-2 rounded-full ${
                  agent.status === "online" ? "bg-emerald-400" : "bg-amber-400"
                }`}
              />
            </div>
          ))
        ) : (
          <p className={`text-xs ${CRM_SURFACES.textLabel}`}>Sin agentes en línea</p>
        )}
      </section>

      <section className="space-y-2 p-4">
        <h3 className={`text-[11px] font-semibold uppercase tracking-wide ${CRM_SURFACES.textMuted}`}>
          Historial
        </h3>
        <p className={`text-xs ${CRM_SURFACES.textMuted}`}>
          Última actividad: {formatCrmDate(conversation.updated_at)}
        </p>
      </section>
    </aside>
  );
};
