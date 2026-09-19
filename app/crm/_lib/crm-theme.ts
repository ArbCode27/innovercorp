/** Domain-only CRM chrome. Controls use shadcn tokens and primitives. */
export const CRM_SURFACES = {
  page: "crm-canvas text-foreground",
  elevated: "crm-glass",
  elevatedTranslucent: "crm-glass-strong",
  card: "crm-glass",
  border: "border-border",
  divider: "divide-border",
  hover: "hover:bg-accent",
  hoverStrong: "hover:bg-accent/80",
  textPrimary: "text-foreground",
  textSecondary: "text-muted-foreground",
  textMuted: "text-muted-foreground",
  textLabel: "text-muted-foreground",
  textHeading: "text-foreground",
  placeholder: "placeholder:text-muted-foreground",
} as const;

export const CRM_RADIUS = {
  panel: "rounded-3xl",
  card: "rounded-2xl",
  control: "rounded-xl",
} as const;

export const CRM_PANEL = `crm-glass ${CRM_RADIUS.panel} overflow-hidden`;

/** Conversation list item states in the inbox sidebar. */
export const CRM_INBOX_ITEM = {
  active: "rounded-2xl border border-primary/25 bg-accent/90",
  unread:
    "rounded-2xl border border-warning/40 bg-warning/15 dark:border-warning/30 dark:bg-warning/10",
  default: "rounded-2xl border border-transparent",
} as const;

export const CRM_HISTORY_ITEM = {
  active:
    "rounded-2xl border border-success/40 bg-success/15 dark:border-success/30 dark:bg-success/10",
  default: "rounded-2xl border border-transparent",
} as const;

export const CRM_BUBBLE = {
  outgoing:
    "rounded-3xl rounded-br-lg border border-primary/70 bg-primary/30 text-foreground backdrop-blur-md dark:border-primary/50 dark:bg-primary/20",
  incoming:
    "rounded-3xl rounded-bl-lg border border-border bg-card/80 text-foreground backdrop-blur-md",
} as const;

/** Count pills (inbox unread, nav). White on a darker gold so AA holds. */
export const CRM_COUNT_BADGE =
  "border-transparent bg-[oklch(0.55_0.15_75)] font-bold text-white";
