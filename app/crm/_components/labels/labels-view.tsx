"use client";

import { useState } from "react";
import { Plus } from "lucide-react";
import { CrmButton } from "../shared/crm-button";
import type { Conversation, CreateLabelInput, Label } from "../../_lib/types";
import { CRM_SURFACES } from "../../_lib/crm-theme";
import { LabelFormDialog } from "./label-form-dialog";
import { LabelsList } from "./labels-list";

interface LabelsViewProps {
  labels: Label[];
  conversations: Conversation[];
  onCreateLabel: (input: CreateLabelInput) => Promise<void>;
  onDeleteLabel: (label: Label) => Promise<void>;
}

export const LabelsView = ({
  labels,
  conversations,
  onCreateLabel,
  onDeleteLabel,
}: LabelsViewProps) => {
  const [isDialogOpen, setIsDialogOpen] = useState(false);

  return (
    <div className={`crm-scrollbar min-h-0 flex-1 overflow-y-auto p-6 ${CRM_SURFACES.page}`}>
      <div className="mb-6 flex items-center justify-between gap-4">
        <div>
          <h2 className={`text-2xl font-semibold ${CRM_SURFACES.textPrimary}`}>Etiquetas</h2>
          <p className={`text-sm ${CRM_SURFACES.textMuted}`}>
            Organiza tus conversaciones por categoría
          </p>
        </div>
        <CrmButton type="button" onClick={() => setIsDialogOpen(true)}>
          <Plus className="mr-2 size-4" aria-hidden="true" />
          Nueva etiqueta
        </CrmButton>
      </div>
      <LabelsList labels={labels} conversations={conversations} onDeleteLabel={onDeleteLabel} />
      <LabelFormDialog
        open={isDialogOpen}
        onOpenChange={setIsDialogOpen}
        onCreateLabel={onCreateLabel}
      />
    </div>
  );
};
