import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import type { Client, Ticket } from "../../_lib/types";
import { AvatarInitials } from "../shared/avatar-initials";
import { StatusBadge } from "../shared/status-badge";

interface ClientsTableProps {
  clients: Client[];
  tickets: Ticket[];
}

export const ClientsTable = ({ clients, tickets }: ClientsTableProps) => (
  <div className="overflow-hidden rounded-xl border border-white/10 bg-[#161922]">
    <Table>
      <TableHeader>
        <TableRow className="border-white/10 hover:bg-transparent">
          <TableHead className="text-slate-500">Cliente</TableHead>
          <TableHead className="text-slate-500">Teléfono</TableHead>
          <TableHead className="text-slate-500">Plan</TableHead>
          <TableHead className="text-slate-500">Zona</TableHead>
          <TableHead className="text-slate-500">Estado</TableHead>
          <TableHead className="text-slate-500">Tickets</TableHead>
        </TableRow>
      </TableHeader>
      <TableBody>
        {clients.length ? (
          clients.map((client) => {
            const openTickets = tickets.filter(
              (ticket) => ticket.client_id === client.id && ticket.status !== "Resuelto"
            );

            return (
              <TableRow key={client.id} className="border-white/10 hover:bg-white/[.03]">
                <TableCell>
                  <div className="flex items-center gap-2">
                    <AvatarInitials
                      name={client.name}
                      initials={client.initials}
                      color={client.color}
                      bg={client.bg}
                      size="sm"
                    />
                    <span className="font-medium text-slate-100">{client.name}</span>
                  </div>
                </TableCell>
                <TableCell className="font-mono text-slate-400">{client.phone}</TableCell>
                <TableCell className="text-slate-300">{client.plan || "—"}</TableCell>
                <TableCell className="text-slate-400">{client.zone || "—"}</TableCell>
                <TableCell className="text-slate-300">{client.account || "—"}</TableCell>
                <TableCell>
                  <StatusBadge
                    status={
                      openTickets.length
                        ? `${openTickets.length} abierto${openTickets.length > 1 ? "s" : ""}`
                        : "Resuelto"
                    }
                  />
                </TableCell>
              </TableRow>
            );
          })
        ) : (
          <TableRow className="border-white/10">
            <TableCell colSpan={6} className="h-24 text-center text-slate-500">
              Sin clientes aún.
            </TableCell>
          </TableRow>
        )}
      </TableBody>
    </Table>
  </div>
);
