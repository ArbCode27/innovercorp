"use client";

import { useState } from "react";
import { Plus } from "lucide-react";
import { CrmButton } from "../shared/crm-button";
import type { Agent, Client, CreateTicketInput, Ticket } from "../../_lib/types";
import { CRM_SURFACES } from "../../_lib/crm-theme";
import { TicketFormDialog } from "./ticket-form-dialog";
import { TicketsStats } from "./tickets-stats";
import { TicketsTable } from "./tickets-table";

interface TicketsViewProps {
  tickets: Ticket[];
  clients: Client[];
  clientsById: Map<number, Client>;
  agents: Agent[];
  onCreateTicket: (input: CreateTicketInput) => Promise<void>;
}

export const TicketsView = ({
  tickets,
  clients,
  clientsById,
  agents,
  onCreateTicket,
}: TicketsViewProps) => {
  const [isDialogOpen, setIsDialogOpen] = useState(false);

  return (
    <div className={`crm-scrollbar min-h-0 flex-1 overflow-y-auto p-6 ${CRM_SURFACES.page}`}>
      <div className="mb-6 flex items-center justify-between gap-4">
        <div>
          <h2 className={`text-2xl font-semibold ${CRM_SURFACES.textPrimary}`}>Tickets</h2>
          <p className={`text-sm ${CRM_SURFACES.textMuted}`}>Seguimiento de casos</p>
        </div>
        <CrmButton type="button" onClick={() => setIsDialogOpen(true)}>
          <Plus className="mr-2 size-4" aria-hidden="true" />
          Nuevo ticket
        </CrmButton>
      </div>
      <div className="space-y-5">
        <TicketsStats tickets={tickets} />
        <TicketsTable tickets={tickets} clientsById={clientsById} />
      </div>
      <TicketFormDialog
        open={isDialogOpen}
        clients={clients}
        agents={agents}
        onOpenChange={setIsDialogOpen}
        onCreateTicket={onCreateTicket}
      />
    </div>
  );
};
