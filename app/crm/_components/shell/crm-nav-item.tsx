import type { LucideIcon } from "lucide-react";
import type { CrmView } from "../../_lib/types";

interface CrmNavItemProps {
  icon: LucideIcon;
  label: string;
  view: CrmView;
  isActive: boolean;
  onSelect: (view: CrmView) => void;
}

export const CrmNavItem = ({
  icon: Icon,
  label,
  view,
  isActive,
  onSelect,
}: CrmNavItemProps) => (
  <button
    type="button"
    onClick={() => onSelect(view)}
    aria-label={label}
    title={label}
    className={`relative flex size-10 items-center justify-center rounded-lg transition focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-blue-400 ${
      isActive
        ? "bg-blue-500/15 text-blue-300"
        : "text-slate-500 hover:bg-white/5 hover:text-slate-300"
    }`}
  >
    <Icon className="size-5" aria-hidden="true" />
  </button>
);
