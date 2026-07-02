/** CRM surface tokens — always pair light + dark for theme switching. */
export const CRM_SURFACES = {
  page: "bg-slate-50 text-slate-900 dark:bg-[#0f1117] dark:text-slate-100",
  elevated: "bg-white dark:bg-[#161922]",
  elevatedTranslucent: "bg-white/95 dark:bg-[#161922]/95",
  input: "bg-slate-100 dark:bg-[#1d2130]",
  inputReadonly: "bg-slate-200 dark:bg-[#181b24]",
  card: "bg-white dark:bg-[#1d2130]",
  border: "border-slate-200 dark:border-white/10",
  divider: "divide-slate-200 dark:divide-white/10",
  hover: "hover:bg-slate-100 dark:hover:bg-white/[.04]",
  hoverStrong: "hover:bg-slate-200 dark:hover:bg-white/10",
  textPrimary: "text-slate-900 dark:text-slate-100",
  textSecondary: "text-slate-600 dark:text-slate-300",
  textMuted: "text-slate-500 dark:text-slate-400",
  textLabel: "text-slate-500 dark:text-slate-600",
  textHeading: "text-slate-700 dark:text-slate-300",
  placeholder: "placeholder:text-slate-500",
} as const;

export const CRM_DIALOG =
  "border-slate-200 bg-white text-slate-900 dark:border-white/10 dark:bg-[#161922] dark:text-slate-100";

export const CRM_MENU =
  "border-slate-200 bg-white text-slate-900 dark:border-white/10 dark:bg-[#161922] dark:text-slate-100";

export const CRM_MENU_ITEM =
  "cursor-pointer text-slate-700 focus:bg-slate-100 focus:text-slate-900 dark:text-slate-200 dark:focus:bg-white/10 dark:focus:text-white";

/** Shared focus ring for interactive CRM controls (WCAG-visible focus). */
export const CRM_FOCUS_RING =
  "focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-blue-400 focus-visible:ring-offset-2 focus-visible:ring-offset-slate-50 dark:focus-visible:ring-offset-[#0f1117]";

/** Conversation list item states in the inbox sidebar. */
export const CRM_INBOX_ITEM = {
  active:
    "border-b border-l-2 border-l-blue-500 border-slate-200 bg-blue-50 dark:border-white/10 dark:bg-blue-950/40",
  unread:
    "border-b border-l-4 border-l-amber-400 border-slate-200 bg-amber-50/60 dark:border-l-amber-400 dark:border-white/10 dark:bg-amber-950/25",
  default: "border-b border-slate-200 dark:border-white/10",
} as const;

/** Accessible badge tones for light and dark modes. */
export const CRM_BADGE_TONES = {
  blue: "border-blue-300 bg-blue-50 text-blue-800 dark:border-blue-500/40 dark:bg-blue-950/60 dark:text-blue-100",
  amber:
    "border-amber-300 bg-amber-50 text-amber-900 dark:border-amber-500/40 dark:bg-amber-950/60 dark:text-amber-100",
  emerald:
    "border-emerald-300 bg-emerald-50 text-emerald-900 dark:border-emerald-500/40 dark:bg-emerald-950/60 dark:text-emerald-100",
  red: "border-red-300 bg-red-50 text-red-800 dark:border-red-500/40 dark:bg-red-950/60 dark:text-red-100",
  violet:
    "border-violet-300 bg-violet-50 text-violet-900 dark:border-violet-500/40 dark:bg-violet-950/60 dark:text-violet-100",
  rose: "border-rose-300 bg-rose-50 text-rose-900 dark:border-rose-500/40 dark:bg-rose-950/60 dark:text-rose-100",
  slate:
    "border-slate-300 bg-slate-100 text-slate-800 dark:border-slate-500/40 dark:bg-slate-900/60 dark:text-slate-200",
  neutral:
    "border-slate-200 bg-slate-50 text-slate-700 dark:border-white/15 dark:bg-white/5 dark:text-slate-200",
} as const;

export type CrmBadgeTone = keyof typeof CRM_BADGE_TONES;
