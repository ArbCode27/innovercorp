"use client";

import { useState } from "react";
import { Plus } from "lucide-react";
import { Button } from "@/components/ui/button";
import type { Conversation, CreateLabelInput, Label } from "../../_lib/types";
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
    <div className="min-h-0 flex-1 overflow-y-auto bg-[#0f1117] p-6">
      <div className="mb-6 flex items-center justify-between gap-4">
        <div>
          <h2 className="text-2xl font-semibold text-slate-100">Etiquetas</h2>
          <p className="text-sm text-slate-500">
            Organiza tus conversaciones por categoría
          </p>
        </div>
        <Button type="button" onClick={() => setIsDialogOpen(true)} className="bg-blue-500">
          <Plus className="mr-2 size-4" aria-hidden="true" />
          Nueva etiqueta
        </Button>
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
