"use client";

import { Trash2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import type { Conversation, Label } from "../../_lib/types";
import { LabelChip } from "../shared/label-chip";

interface LabelsListProps {
  labels: Label[];
  conversations: Conversation[];
  onDeleteLabel: (label: Label) => Promise<void>;
}

export const LabelsList = ({ labels, conversations, onDeleteLabel }: LabelsListProps) => (
  <div className="max-w-3xl overflow-hidden rounded-xl border border-white/10 bg-[#161922]">
    <div className="border-b border-white/10 px-5 py-4 text-sm font-semibold text-slate-300">
      Etiquetas ({labels.length})
    </div>
    <div className="divide-y divide-white/10 px-5 py-2">
      {labels.length ? (
        labels.map((label) => {
          const usage = conversations.filter((conversation) =>
            conversation.label_ids.includes(label.id)
          ).length;

          return (
            <div key={label.id} className="flex items-center gap-3 py-3">
              <span
                className="size-2.5 rounded-full"
                style={{ backgroundColor: label.color }}
                aria-hidden="true"
              />
              <span className="flex-1 text-sm text-slate-200">{label.name}</span>
              <span className="text-xs text-slate-600">{usage} conv.</span>
              <LabelChip label={label} />
              <Button
                type="button"
                variant="ghost"
                size="icon"
                onClick={() => onDeleteLabel(label)}
                className="size-8 text-slate-500 hover:bg-red-400/10 hover:text-red-300"
                aria-label={`Eliminar ${label.name}`}
              >
                <Trash2 className="size-4" aria-hidden="true" />
              </Button>
            </div>
          );
        })
      ) : (
        <div className="py-8 text-sm text-slate-500">Sin etiquetas.</div>
      )}
    </div>
  </div>
);
