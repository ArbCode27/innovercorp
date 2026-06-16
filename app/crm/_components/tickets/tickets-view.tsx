"use client";

import { useState } from "react";
import { Plus } from "lucide-react";
import { Button } from "@/components/ui/button";
import type { Agent, Client, CreateTicketInput, Ticket } from "../../_lib/types";
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
    <div className="min-h-0 flex-1 overflow-y-auto bg-[#0f1117] p-6">
      <div className="mb-6 flex items-center justify-between gap-4">
        <div>
          <h2 className="text-2xl font-semibold text-slate-100">Tickets</h2>
          <p className="text-sm text-slate-500">Seguimiento de casos</p>
        </div>
        <Button type="button" onClick={() => setIsDialogOpen(true)} className="bg-blue-500">
          <Plus className="mr-2 size-4" aria-hidden="true" />
          Nuevo ticket
        </Button>
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
