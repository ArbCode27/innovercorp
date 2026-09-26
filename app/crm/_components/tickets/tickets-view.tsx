"use client";

import type { CrmWisproCaso } from "@/lib/wispro-types";
import { WisproIssuesPanel } from "./wispro-issues-panel";

interface TicketsViewProps {
  onOpenClientChat?: (caso: CrmWisproCaso) => void;
  onCasosChanged?: () => void;
}

export const TicketsView = ({
  onOpenClientChat,
  onCasosChanged,
}: TicketsViewProps) => (
  <div className="crm-scrollbar min-h-0 flex-1 overflow-y-auto p-4 md:p-6">
    <WisproIssuesPanel
      onOpenClientChat={onOpenClientChat}
      onCasosChanged={onCasosChanged}
    />
  </div>
);
