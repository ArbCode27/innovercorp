-- Per-conversation AI turn lock so burst inbound messages share one Nova run.
-- Run in Supabase SQL editor (or via supabase db push).

ALTER TABLE public.conversations
  ADD COLUMN IF NOT EXISTS ai_run_id text,
  ADD COLUMN IF NOT EXISTS ai_run_locked_at timestamptz;

CREATE INDEX IF NOT EXISTS conversations_ai_run_locked_at_idx
  ON public.conversations (ai_run_locked_at)
  WHERE ai_run_id IS NOT NULL;
