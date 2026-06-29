"use client";

import type { Agent, Label } from "../../_lib/types";
import { CRM_SURFACES } from "../../_lib/crm-theme";
import { useConversationHistory } from "../../_hooks/use-conversation-history";
import { LoadingState } from "../shared/loading-state";
import { HistoryDetailPanel } from "./history-detail-panel";
import { HistoryFilters } from "./history-filters";
import { HistoryList } from "./history-list";

interface HistoryViewProps {
  agents: Agent[];
  labels: Label[];
}

export const HistoryView = ({ agents, labels }: HistoryViewProps) => {
  const history = useConversationHistory(agents, labels);

  const selectedLabels =
    history.selectedEntry?.label_ids
      .map((id) => history.labelsById.get(id))
      .filter((label): label is Label => Boolean(label)) ?? [];

  const resolvedByAgent = history.selectedEntry?.resolved_by
    ? (history.agentsById.get(history.selectedEntry.resolved_by) ?? null)
    : null;

  const assignedAgent = history.selectedEntry?.agent_id
    ? (history.agentsById.get(history.selectedEntry.agent_id) ?? null)
    : null;

  if (history.isLoading) {
    return (
      <div className="flex min-h-0 flex-1 items-center justify-center overflow-hidden">
        <LoadingState label="Cargando historial..." />
      </div>
    );
  }

  return (
    <div className="flex max-h-[100vh] min-h-0 flex-1 overflow-hidden">
      <aside
        className={`flex min-h-0 w-80 shrink-0 flex-col overflow-hidden border-r ${CRM_SURFACES.border} ${CRM_SURFACES.elevated}`}>
        <div className={`border-b p-4 ${CRM_SURFACES.border}`}>
          <h2 className={`text-sm font-semibold ${CRM_SURFACES.textPrimary}`}>
            Historial
          </h2>
          <p className={`mt-1 text-xs ${CRM_SURFACES.textMuted}`}>
            {history.filteredEntries.length} de {history.entries.length}{" "}
            archivadas
          </p>
        </div>

        <HistoryFilters
          searchTerm={history.searchTerm}
          onSearchChange={history.setSearchTerm}
        />

        <HistoryList
          groups={history.groupedEntries}
          selectedHistoryId={history.selectedHistoryId}
          onSelect={history.selectHistoryEntry}
        />
      </aside>

      <HistoryDetailPanel
        entry={history.selectedEntry}
        resolvedByAgent={resolvedByAgent}
        assignedAgent={assignedAgent}
        labels={selectedLabels}
        totalEntries={history.entries.length}
      />
    </div>
  );
};
