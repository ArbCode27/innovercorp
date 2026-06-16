import type { LucideIcon } from "lucide-react";

interface EmptyStateProps {
  icon: LucideIcon;
  title: string;
  description?: string;
}

export const EmptyState = ({ icon: Icon, title, description }: EmptyStateProps) => (
  <div className="flex h-full min-h-48 flex-col items-center justify-center gap-3 p-8 text-center text-slate-500">
    <Icon className="size-10 stroke-[1.4]" aria-hidden="true" />
    <div>
      <p className="text-sm font-medium text-slate-300">{title}</p>
      {description ? <p className="mt-1 text-xs text-slate-500">{description}</p> : null}
    </div>
  </div>
);
