import { cn } from "@/lib/utils";
import { CRM_FOCUS_RING } from "../../_lib/crm-theme";

interface CrmFilterChipProps {
  label: string;
  isActive: boolean;
  onClick: () => void;
}

export const CrmFilterChip = ({ label, isActive, onClick }: CrmFilterChipProps) => (
  <button
    type="button"
    onClick={onClick}
    aria-pressed={isActive}
    className={cn(
      CRM_FOCUS_RING,
      "rounded-full border px-3 py-1 text-xs font-medium transition",
      isActive
        ? "border-blue-400 bg-blue-50 text-blue-900 dark:border-blue-500/50 dark:bg-blue-950/70 dark:text-blue-100"
        : "border-transparent text-slate-500 hover:text-slate-800 dark:text-slate-400 dark:hover:text-slate-200",
    )}>
    {label}
  </button>
);
