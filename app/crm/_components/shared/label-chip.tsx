import type { CSSProperties } from "react";
import type { Label } from "../../_lib/types";

interface LabelChipProps {
  label: Label;
  selected?: boolean;
  onClick?: () => void;
}

export const LabelChip = ({ label, selected, onClick }: LabelChipProps) => {
  const Component = onClick ? "button" : "span";

  return (
    <Component
      type={onClick ? "button" : undefined}
      onClick={onClick}
      className={`inline-flex items-center gap-1.5 rounded-full border px-2.5 py-1 text-xs font-medium transition ${
        selected ? "border-current opacity-100" : "border-transparent opacity-80"
      } ${onClick ? "hover:opacity-100 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-blue-400" : ""}`}
      style={{ color: label.color, backgroundColor: label.bg } as CSSProperties}
    >
      <span
        className="size-1.5 rounded-full"
        style={{ backgroundColor: label.color } as CSSProperties}
        aria-hidden="true"
      />
      {label.name}
    </Component>
  );
};
