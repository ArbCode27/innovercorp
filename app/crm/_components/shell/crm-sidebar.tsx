"use client";

import { Bot, Headphones, Layers, LogOut, Tags, Ticket, Users } from "lucide-react";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { CRM_NAV_ITEMS } from "../../_lib/constants";
import type { Agent, CrmView } from "../../_lib/types";
import { AvatarInitials } from "../shared/avatar-initials";
import { StatusBadge } from "../shared/status-badge";
import { CrmNavItem } from "./crm-nav-item";

interface CrmSidebarProps {
  agent: Agent;
  activeView: CrmView;
  onSelectView: (view: CrmView) => void;
  onToggleStatus: () => void;
  onLogout: () => void;
}

const icons = {
  conversations: Headphones,
  clients: Users,
  tickets: Ticket,
  labels: Tags,
  agents: Bot,
};

export const CrmSidebar = ({
  agent,
  activeView,
  onSelectView,
  onToggleStatus,
  onLogout,
}: CrmSidebarProps) => (
  <aside className="flex w-16 shrink-0 flex-col items-center border-r border-white/10 bg-[#161922] py-4">
    <div className="mb-5 flex size-10 items-center justify-center rounded-xl bg-blue-500 text-white">
      <Layers className="size-5" aria-hidden="true" />
    </div>

    <nav className="flex flex-1 flex-col gap-1" aria-label="Navegación CRM">
      {CRM_NAV_ITEMS.map((item) => (
        <CrmNavItem
          key={item.id}
          icon={icons[item.id]}
          label={item.label}
          view={item.id}
          isActive={activeView === item.id}
          onSelect={onSelectView}
        />
      ))}
    </nav>

    <DropdownMenu>
      <DropdownMenuTrigger asChild>
        <button
          type="button"
          className="rounded-full focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-blue-400"
          title="Abrir menú de agente"
          aria-label="Abrir menú de agente"
        >
          <AvatarInitials
            name={agent.name}
            initials={agent.initials}
            color={agent.avatar_color}
            bg={agent.avatar_bg}
            size="md"
          />
        </button>
      </DropdownMenuTrigger>
      <DropdownMenuContent
        side="right"
        align="end"
        className="w-60 border-white/10 bg-[#161922] text-slate-100"
      >
        <DropdownMenuLabel>
          <span className="block truncate text-sm font-medium text-slate-100">
            {agent.name}
          </span>
          <span className="mt-1 flex items-center">
            <StatusBadge status={agent.status} />
          </span>
        </DropdownMenuLabel>
        <DropdownMenuSeparator className="bg-white/10" />
        <DropdownMenuItem
          onClick={onToggleStatus}
          className="cursor-pointer focus:bg-white/10"
        >
          Cambiar mi estado
        </DropdownMenuItem>
        <DropdownMenuItem
          onClick={onLogout}
          className="cursor-pointer text-red-300 focus:bg-red-400/10 focus:text-red-200"
        >
          <LogOut className="size-4" aria-hidden="true" />
          Salir
        </DropdownMenuItem>
      </DropdownMenuContent>
    </DropdownMenu>
  </aside>
);
