"use client";

import { WisproIssuesPanel } from "./wispro-issues-panel";

export const TicketsView = () => (
  <div className="crm-scrollbar min-h-0 flex-1 overflow-y-auto p-4 md:p-6">
    <WisproIssuesPanel />
  </div>
);
