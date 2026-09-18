-- Speed up paginated history list and lazy message pages.

CREATE INDEX IF NOT EXISTS conversation_history_resolved_at_id_idx
  ON public.conversation_history (resolved_at DESC, id DESC);

CREATE INDEX IF NOT EXISTS history_messages_history_created_idx
  ON public.history_messages (history_id, created_at DESC, id DESC);
