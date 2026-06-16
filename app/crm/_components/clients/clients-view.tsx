"use client";

import { useState } from "react";
import { Plus } from "lucide-react";
import { Button } from "@/components/ui/button";
import type { Client, CreateClientInput, Ticket } from "../../_lib/types";
import { ClientFormDialog } from "./client-form-dialog";
import { ClientsStats } from "./clients-stats";
import { ClientsTable } from "./clients-table";

interface ClientsViewProps {
  clients: Client[];
  tickets: Ticket[];
  onCreateClient: (input: CreateClientInput) => Promise<void>;
}

export const ClientsView = ({ clients, tickets, onCreateClient }: ClientsViewProps) => {
  const [isDialogOpen, setIsDialogOpen] = useState(false);

  return (
    <div className="min-h-0 flex-1 overflow-y-auto bg-[#0f1117] p-6">
      <div className="mb-6 flex items-center justify-between gap-4">
        <div>
          <h2 className="text-2xl font-semibold text-slate-100">Clientes</h2>
          <p className="text-sm text-slate-500">Base de datos de suscriptores</p>
        </div>
        <Button type="button" onClick={() => setIsDialogOpen(true)} className="bg-blue-500">
          <Plus className="mr-2 size-4" aria-hidden="true" />
          Nuevo cliente
        </Button>
      </div>
      <div className="space-y-5">
        <ClientsStats clients={clients} tickets={tickets} />
        <ClientsTable clients={clients} tickets={tickets} />
      </div>
      <ClientFormDialog
        open={isDialogOpen}
        onOpenChange={setIsDialogOpen}
        onCreateClient={onCreateClient}
      />
    </div>
  );
};
