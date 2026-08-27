-- Nova reliability: AI run tracing + editable recovery messages.
-- Run in Supabase SQL editor (or via supabase db push).

ALTER TABLE public.crm_settings
  ADD COLUMN IF NOT EXISTS ai_recovery_messages jsonb;

UPDATE public.crm_settings
SET ai_recovery_messages = COALESCE(
  ai_recovery_messages,
  '{"ack": null, "soft_hold": null, "hard_fallback": null}'::jsonb
)
WHERE id = 1;

CREATE TABLE IF NOT EXISTS public.ai_runs (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  conversation_id bigint REFERENCES public.conversations(id) ON DELETE SET NULL,
  trigger_message_id bigint REFERENCES public.messages(id) ON DELETE SET NULL,
  run_id text,
  status text NOT NULL DEFAULT 'started'
    CHECK (status IN (
      'started',
      'ack_sent',
      'replied',
      'soft_hold',
      'handoff',
      'skipped',
      'failed',
      'circuit_open'
    )),
  intent text,
  model text,
  error text,
  circuit_open boolean NOT NULL DEFAULT false,
  started_at timestamptz NOT NULL DEFAULT now(),
  finished_at timestamptz,
  duration_ms integer,
  metadata jsonb NOT NULL DEFAULT '{}'::jsonb
);

CREATE INDEX IF NOT EXISTS ai_runs_started_at_idx
  ON public.ai_runs (started_at DESC);

CREATE INDEX IF NOT EXISTS ai_runs_conversation_id_idx
  ON public.ai_runs (conversation_id, started_at DESC);

CREATE INDEX IF NOT EXISTS ai_runs_status_idx
  ON public.ai_runs (status, started_at DESC);

ALTER TABLE public.ai_runs ENABLE ROW LEVEL SECURITY;
