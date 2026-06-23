"use client";

import { useState } from "react";
import { Plus } from "lucide-react";
import { CrmButton } from "../shared/crm-button";
import type { Client, CreateClientInput, Ticket } from "../../_lib/types";
import { ClientFormDialog } from "./client-form-dialog";
import { ClientsStats } from "./clients-stats";
import { CRM_SURFACES } from "../../_lib/crm-theme";
import { ClientsTable } from "./clients-table";

interface ClientsViewProps {
  clients: Client[];
  tickets: Ticket[];
  onCreateClient: (input: CreateClientInput) => Promise<void>;
}

export const ClientsView = ({ clients, tickets, onCreateClient }: ClientsViewProps) => {
  const [isDialogOpen, setIsDialogOpen] = useState(false);

  return (
    <div className={`crm-scrollbar min-h-0 flex-1 overflow-y-auto p-6 ${CRM_SURFACES.page}`}>
      <div className="mb-6 flex items-center justify-between gap-4">
        <div>
          <h2 className={`text-2xl font-semibold ${CRM_SURFACES.textPrimary}`}>Clientes</h2>
          <p className={`text-sm ${CRM_SURFACES.textMuted}`}>Base de datos de suscriptores</p>
        </div>
        <CrmButton type="button" onClick={() => setIsDialogOpen(true)}>
          <Plus className="mr-2 size-4" aria-hidden="true" />
          Nuevo cliente
        </CrmButton>
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
