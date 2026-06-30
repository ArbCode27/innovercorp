import { cn } from "@/lib/utils";
import { CRM_FOCUS_RING } from "../../_lib/crm-theme";

interface CrmFilterChipProps {
  label: string;
  count?: number;
  isActive: boolean;
  onClick: () => void;
}

export const CrmFilterChip = ({
  label,
  count,
  isActive,
  onClick,
}: CrmFilterChipProps) => {
  const accessibleLabel =
    count === undefined ? label : `${label}, ${count} conversaciones`;

  return (
    <button
      type="button"
      onClick={onClick}
      aria-pressed={isActive}
      aria-label={accessibleLabel}
      className={cn(
        CRM_FOCUS_RING,
        "inline-flex items-center gap-1.5 rounded-full border px-3 py-1 text-xs font-medium transition",
        isActive
          ? "border-blue-400 bg-blue-50 text-blue-900 dark:border-blue-500/50 dark:bg-blue-950/70 dark:text-blue-100"
          : "border-transparent text-slate-500 hover:text-slate-800 dark:text-slate-400 dark:hover:text-slate-200",
      )}>
      <span>{label}</span>
      {count !== undefined ? (
        <span
          aria-hidden="true"
          className={cn(
            "rounded-full px-1.5 py-0.5 text-[10px] font-semibold leading-none",
            isActive
              ? "bg-blue-200/80 text-blue-900 dark:bg-blue-900/80 dark:text-blue-100"
              : "bg-slate-200/80 text-slate-600 dark:bg-white/10 dark:text-slate-300",
          )}>
          {count}
        </span>
      ) : null}
    </button>
  );
};
