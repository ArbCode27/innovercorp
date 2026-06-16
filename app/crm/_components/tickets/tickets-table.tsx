import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import type { Client, Ticket } from "../../_lib/types";
import { formatCrmDate } from "../../_lib/formatters";
import { AvatarInitials } from "../shared/avatar-initials";
import { StatusBadge } from "../shared/status-badge";

interface TicketsTableProps {
  tickets: Ticket[];
  clientsById: Map<number, Client>;
}

export const TicketsTable = ({ tickets, clientsById }: TicketsTableProps) => (
  <div className="overflow-hidden rounded-xl border border-white/10 bg-[#161922]">
    <Table>
      <TableHeader>
        <TableRow className="border-white/10 hover:bg-transparent">
          <TableHead className="text-slate-500">ID</TableHead>
          <TableHead className="text-slate-500">Cliente</TableHead>
          <TableHead className="text-slate-500">Tipo</TableHead>
          <TableHead className="text-slate-500">Estado</TableHead>
          <TableHead className="text-slate-500">Agente</TableHead>
          <TableHead className="text-slate-500">Creado</TableHead>
        </TableRow>
      </TableHeader>
      <TableBody>
        {tickets.length ? (
          tickets.map((ticket) => {
            const client = clientsById.get(ticket.client_id);

            return (
              <TableRow key={ticket.id} className="border-white/10 hover:bg-white/[.03]">
                <TableCell className="font-mono text-slate-400">{ticket.id}</TableCell>
                <TableCell>
                  {client ? (
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
                  ) : (
                    <span className="text-slate-500">Cliente no encontrado</span>
                  )}
                </TableCell>
                <TableCell className="text-slate-300">{ticket.type}</TableCell>
                <TableCell>
                  <StatusBadge status={ticket.status} />
                </TableCell>
                <TableCell className="text-slate-400">{ticket.agent}</TableCell>
                <TableCell className="text-slate-500">
                  {formatCrmDate(ticket.created_at)}
                </TableCell>
              </TableRow>
            );
          })
        ) : (
          <TableRow className="border-white/10">
            <TableCell colSpan={6} className="h-24 text-center text-slate-500">
              Sin tickets.
            </TableCell>
          </TableRow>
        )}
      </TableBody>
    </Table>
  </div>
);
