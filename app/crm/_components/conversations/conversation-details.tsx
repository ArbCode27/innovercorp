"use client";

import type { Agent, Client, Conversation, Label, Ticket } from "../../_lib/types";
import { formatCrmDate } from "../../_lib/formatters";
import { AvatarInitials } from "../shared/avatar-initials";
import { LabelChip } from "../shared/label-chip";
import { StatusBadge } from "../shared/status-badge";

interface ConversationDetailsProps {
  conversation: Conversation;
  client: Client | null;
  labels: Label[];
  tickets: Ticket[];
  agents: Agent[];
  onToggleLabel: (labelId: number) => Promise<void>;
}

const fieldClass = "space-y-1";
const labelClass = "text-[11px] uppercase tracking-wide text-slate-600";
const valueClass = "text-sm font-medium text-slate-200";

export const ConversationDetails = ({
  conversation,
  client,
  labels,
  tickets,
  agents,
  onToggleLabel,
}: ConversationDetailsProps) => {
  const activeTicket =
    tickets.find((ticket) => ticket.status !== "Resuelto") || tickets[0] || null;
  const onlineAgents = agents.filter(
    (agent) => agent.status === "online" || agent.status === "busy"
  );

  return (
    <aside className="hidden w-72 shrink-0 overflow-y-auto border-l border-white/10 bg-[#161922] lg:block">
      <section className="border-b border-white/10 p-4">
        <h3 className="mb-3 text-[11px] font-semibold uppercase tracking-wide text-slate-500">
          Etiquetas
        </h3>
        <div className="flex flex-wrap gap-2">
          {labels.length ? (
            labels.map((label) => (
              <LabelChip
                key={label.id}
                label={label}
                selected={conversation.label_ids.includes(label.id)}
                onClick={() => onToggleLabel(label.id)}
              />
            ))
          ) : (
            <p className="text-xs text-slate-600">Sin etiquetas</p>
          )}
        </div>
      </section>

      <section className="space-y-4 border-b border-white/10 p-4">
        <h3 className="text-[11px] font-semibold uppercase tracking-wide text-slate-500">
          Ficha del cliente
        </h3>
        {client ? (
          <>
            <div className={fieldClass}>
              <p className={labelClass}>Nombre</p>
              <p className={valueClass}>{client.name}</p>
            </div>
            <div className={fieldClass}>
              <p className={labelClass}>Teléfono</p>
              <p className="font-mono text-sm text-slate-300">{client.phone || "—"}</p>
            </div>
            <div className={fieldClass}>
              <p className={labelClass}>Zona</p>
              <p className={valueClass}>{client.zone || "—"}</p>
            </div>
            <div className={fieldClass}>
              <p className={labelClass}>Estado</p>
              <p className={valueClass}>{client.account || "—"}</p>
            </div>
            <div className={fieldClass}>
              <p className={labelClass}>Plan</p>
              <p className={valueClass}>{client.plan || "—"}</p>
            </div>
          </>
        ) : (
          <p className="text-sm text-amber-300">
            Número desconocido. Crea o asocia un cliente manualmente desde la vista Clientes.
          </p>
        )}
      </section>

      <section className="space-y-3 border-b border-white/10 p-4">
        <h3 className="text-[11px] font-semibold uppercase tracking-wide text-slate-500">
          Ticket activo
        </h3>
        {activeTicket ? (
          <div className="space-y-2">
            <p className="font-mono text-sm text-slate-200">{activeTicket.id}</p>
            <p className="text-sm text-slate-300">{activeTicket.type}</p>
            <StatusBadge status={activeTicket.status} />
            <p className="text-xs text-slate-500">Agente: {activeTicket.agent}</p>
          </div>
        ) : (
          <p className="text-xs text-slate-600">Sin tickets activos</p>
        )}
      </section>

      <section className="space-y-3 border-b border-white/10 p-4">
        <h3 className="text-[11px] font-semibold uppercase tracking-wide text-slate-500">
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
              <span className="min-w-0 flex-1 truncate text-xs text-slate-300">
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
          <p className="text-xs text-slate-600">Sin agentes en línea</p>
        )}
      </section>

      <section className="space-y-2 p-4">
        <h3 className="text-[11px] font-semibold uppercase tracking-wide text-slate-500">
          Historial
        </h3>
        <p className="text-xs text-slate-500">
          Última actividad: {formatCrmDate(conversation.updated_at)}
        </p>
      </section>
    </aside>
  );
};
