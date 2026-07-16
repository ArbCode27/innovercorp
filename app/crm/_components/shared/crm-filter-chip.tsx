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
  const countText = count === undefined ? "" : ` ${count}`;
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
        "inline-flex h-8 shrink-0 items-center rounded-full border px-3 text-xs font-semibold transition",
        isActive
          ? "border-emerald-500/60 bg-emerald-900/20 text-emerald-200"
          : "border-slate-700/70 bg-[#111827] text-slate-300 hover:border-slate-500/80 hover:text-slate-100",
      )}>
      <span>{`${label}${countText}`}</span>
    </button>
  );
};
