"use client";

import { Bot, Headphones, Layers, Tags, Ticket, Users } from "lucide-react";
import { CRM_NAV_ITEMS } from "../../_lib/constants";
import type { Agent, CrmView } from "../../_lib/types";
import { AvatarInitials } from "../shared/avatar-initials";
import { CrmNavItem } from "./crm-nav-item";

interface CrmSidebarProps {
  agent: Agent;
  activeView: CrmView;
  onSelectView: (view: CrmView) => void;
  onToggleStatus: () => void;
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

    <button
      type="button"
      onClick={onToggleStatus}
      className="rounded-full focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-blue-400"
      title="Cambiar mi estado"
      aria-label="Cambiar mi estado"
    >
      <AvatarInitials
        name={agent.name}
        initials={agent.initials}
        color={agent.avatar_color}
        bg={agent.avatar_bg}
        size="md"
      />
    </button>
  </aside>
);
