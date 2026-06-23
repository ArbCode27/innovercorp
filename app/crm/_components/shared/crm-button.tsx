import type { ComponentProps } from "react";
import { cva, type VariantProps } from "class-variance-authority";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";
import { CRM_FOCUS_RING } from "../../_lib/crm-theme";

const crmButtonVariants = cva(
  `${CRM_FOCUS_RING} shadow-sm disabled:opacity-60`,
  {
    variants: {
      variant: {
        primary:
          "bg-blue-600 text-white hover:bg-blue-500 focus-visible:ring-blue-400",
        secondary:
          "border border-slate-200 bg-slate-100 text-slate-900 hover:bg-slate-200 hover:text-slate-950 focus-visible:ring-slate-400 dark:border-white/15 dark:bg-[#1d2130] dark:text-slate-100 dark:hover:bg-white/10 dark:hover:text-white",
        danger:
          "border border-red-300 bg-red-50 text-red-900 hover:bg-red-100 focus-visible:ring-red-400 dark:border-red-500/50 dark:bg-red-950/70 dark:text-red-100 dark:hover:bg-red-900/70",
        success:
          "border border-emerald-300 bg-emerald-50 text-emerald-900 hover:bg-emerald-100 focus-visible:ring-emerald-400 dark:border-emerald-500/50 dark:bg-emerald-950/70 dark:text-emerald-100 dark:hover:bg-emerald-900/70",
        violet:
          "border border-violet-300 bg-violet-50 text-violet-900 hover:bg-violet-100 focus-visible:ring-violet-400 dark:border-violet-500/50 dark:bg-violet-950/70 dark:text-violet-100 dark:hover:bg-violet-900/70",
        ghost:
          "border-transparent bg-transparent text-slate-600 shadow-none hover:bg-slate-100 hover:text-slate-900 focus-visible:ring-slate-400 dark:text-slate-300 dark:hover:bg-white/10 dark:hover:text-slate-100",
        destructive:
          "bg-red-600 text-white hover:bg-red-500 focus-visible:ring-red-400",
      },
    },
    defaultVariants: {
      variant: "primary",
    },
  },
);

type CrmButtonProps = ComponentProps<typeof Button> &
  VariantProps<typeof crmButtonVariants>;

export const CrmButton = ({
  className,
  variant = "primary",
  ...props
}: CrmButtonProps) => (
  <Button className={cn(crmButtonVariants({ variant }), className)} {...props} />
);
