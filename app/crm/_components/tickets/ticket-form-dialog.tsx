"use client";

import { FormEvent, useMemo, useState } from "react";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Textarea } from "@/components/ui/textarea";
import { TICKET_TYPES } from "../../_lib/constants";
import type { Agent, Client, CreateTicketInput } from "../../_lib/types";

interface TicketFormDialogProps {
  open: boolean;
  clients: Client[];
  agents: Agent[];
  onOpenChange: (open: boolean) => void;
  onCreateTicket: (input: CreateTicketInput) => Promise<void>;
}

export const TicketFormDialog = ({
  open,
  clients,
  agents,
  onOpenChange,
  onCreateTicket,
}: TicketFormDialogProps) => {
  const firstClientId = clients[0]?.id ? String(clients[0].id) : "";
  const [clientId, setClientId] = useState(firstClientId);
  const [type, setType] = useState(TICKET_TYPES[0]);
  const [agent, setAgent] = useState("Bot IA");
  const [description, setDescription] = useState("");

  const agentOptions = useMemo(
    () => ["Bot IA", ...agents.map((item) => item.name)],
    [agents]
  );

  const handleSubmit = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    const parsedClientId = Number(clientId || firstClientId);
    if (!parsedClientId) return;

    await onCreateTicket({
      clientId: parsedClientId,
      type,
      agent,
      description: description.trim() || "Sin descripción",
    });
    setDescription("");
    onOpenChange(false);
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="border-white/10 bg-[#161922] text-slate-100">
        <form onSubmit={handleSubmit}>
          <DialogHeader>
            <DialogTitle>Nuevo ticket</DialogTitle>
          </DialogHeader>
          <div className="mt-5 space-y-4">
            <div className="space-y-2">
              <Label>Cliente</Label>
              <Select value={clientId || firstClientId} onValueChange={setClientId}>
                <SelectTrigger className="w-full border-white/10 bg-[#1d2130]">
                  <SelectValue placeholder="Selecciona un cliente" />
                </SelectTrigger>
                <SelectContent>
                  {clients.map((client) => (
                    <SelectItem key={client.id} value={String(client.id)}>
                      {client.name}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div className="grid gap-4 sm:grid-cols-2">
              <div className="space-y-2">
                <Label>Tipo</Label>
                <Select value={type} onValueChange={setType}>
                  <SelectTrigger className="w-full border-white/10 bg-[#1d2130]">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    {TICKET_TYPES.map((item) => (
                      <SelectItem key={item} value={item}>
                        {item}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              <div className="space-y-2">
                <Label>Asignar a</Label>
                <Select value={agent} onValueChange={setAgent}>
                  <SelectTrigger className="w-full border-white/10 bg-[#1d2130]">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    {agentOptions.map((item) => (
                      <SelectItem key={item} value={item}>
                        {item}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
            </div>
            <div className="space-y-2">
              <Label htmlFor="ticket-description">Descripción</Label>
              <Textarea
                id="ticket-description"
                value={description}
                onChange={(event) => setDescription(event.target.value)}
                className="min-h-24 border-white/10 bg-[#1d2130]"
              />
            </div>
          </div>
          <DialogFooter className="mt-5">
            <Button type="button" variant="outline" onClick={() => onOpenChange(false)}>
              Cancelar
            </Button>
            <Button type="submit" className="bg-blue-500">
              Crear ticket
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
};
