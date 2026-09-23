"use client";

import {
  Bot,
  MessageSquareQuote,
  Settings2,
  ShieldCheck,
  Tags,
  Ticket,
  Trophy,
  Users,
  Wallet,
  Wrench,
} from "lucide-react";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { CRM_SURFACES } from "../../_lib/crm-theme";
import type { CrmView } from "../../_lib/types";
import { Button } from "@/components/ui/button";

interface CrmMobileSettingsMenuProps {
  onSelectView: (view: CrmView) => void;
}

const SETTINGS_ITEMS: Array<{ id: CrmView; label: string; icon: typeof Users }> = [
  { id: "clients", label: "Clientes", icon: Users },
  { id: "payments", label: "Pagos", icon: Wallet },
  { id: "tickets", label: "Tickets", icon: Ticket },
  { id: "performance", label: "Rendimiento", icon: Trophy },
  { id: "quick-replies", label: "Respuestas rápidas", icon: MessageSquareQuote },
  { id: "labels", label: "Etiquetas", icon: Tags },
  { id: "agents", label: "Agentes", icon: Bot },
  { id: "supervisors", label: "Gerentes", icon: ShieldCheck },
  { id: "technicians", label: "Técnicos", icon: Wrench },
  { id: "settings", label: "Ajustes", icon: Settings2 },
];

export const CrmMobileSettingsMenu = ({
  onSelectView,
}: CrmMobileSettingsMenuProps) => (
  <DropdownMenu>
    <DropdownMenuTrigger asChild>
      <Button
        type="button"
        variant="secondary"
        size="icon"
        className="size-8 md:hidden"
        aria-label="Abrir configuración del CRM">
        <Settings2 className="size-4" aria-hidden="true" />
      </Button>
    </DropdownMenuTrigger>
    <DropdownMenuContent
      align="end"
      className={`w-48 ${CRM_SURFACES.textPrimary}`}>
      {SETTINGS_ITEMS.map((item) => {
        const Icon = item.icon;
        return (
          <DropdownMenuItem
            key={item.id}
            onClick={() => onSelectView(item.id)}
            className="cursor-pointer">
            <Icon className="size-4" aria-hidden="true" />
            {item.label}
          </DropdownMenuItem>
        );
      })}
    </DropdownMenuContent>
  </DropdownMenu>
);
