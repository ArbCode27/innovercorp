-- Gemini queue worker observability: run-level metrics for /api/worker.
-- Assumes conversation_jobs + pgmq RPCs (queue_send/read/delete) already exist
-- from supabase-cola-agente-ia.sql.

CREATE TABLE IF NOT EXISTS public.worker_runs (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  started_at timestamptz NOT NULL DEFAULT now(),
  finished_at timestamptz,
  processed_count integer NOT NULL DEFAULT 0,
  failed_count integer NOT NULL DEFAULT 0,
  dead_letter_count integer NOT NULL DEFAULT 0,
  queue_depth_after integer,
  batch_size integer,
  concurrency integer,
  error text,
  metadata jsonb NOT NULL DEFAULT '{}'::jsonb
);

CREATE INDEX IF NOT EXISTS worker_runs_started_at_idx
  ON public.worker_runs (started_at DESC);

ALTER TABLE public.worker_runs ENABLE ROW LEVEL SECURITY;

-- Ensure conversation_jobs exists for fresh environments that only apply migrations.
CREATE TABLE IF NOT EXISTS public.conversation_jobs (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  conversation_id bigint REFERENCES public.conversations(id) ON DELETE SET NULL,
  customer_message text,
  status text NOT NULL DEFAULT 'queued'
    CHECK (status IN ('queued', 'processing', 'completed', 'failed')),
  attempts integer NOT NULL DEFAULT 0,
  last_error text,
  msg_id bigint,
  trigger_message_id bigint REFERENCES public.messages(id) ON DELETE SET NULL,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS conversation_jobs_status_idx
  ON public.conversation_jobs (status, updated_at DESC);

CREATE INDEX IF NOT EXISTS conversation_jobs_conversation_id_idx
  ON public.conversation_jobs (conversation_id, created_at DESC);

CREATE INDEX IF NOT EXISTS conversation_jobs_msg_id_idx
  ON public.conversation_jobs (msg_id);

ALTER TABLE public.conversation_jobs
  ADD COLUMN IF NOT EXISTS trigger_message_id bigint REFERENCES public.messages(id) ON DELETE SET NULL;

CREATE TABLE IF NOT EXISTS public.conversation_jobs_dead_letter (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  job_id uuid,
  conversation_id bigint,
  customer_message text,
  attempts integer NOT NULL DEFAULT 0,
  last_error text,
  msg_id bigint,
  trigger_message_id bigint,
  payload jsonb NOT NULL DEFAULT '{}'::jsonb,
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS conversation_jobs_dead_letter_created_at_idx
  ON public.conversation_jobs_dead_letter (created_at DESC);

ALTER TABLE public.conversation_jobs_dead_letter ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.conversation_jobs ENABLE ROW LEVEL SECURITY;

CREATE OR REPLACE FUNCTION public.set_conversation_jobs_updated_at()
RETURNS trigger
LANGUAGE plpgsql
AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS set_conversation_jobs_updated_at ON public.conversation_jobs;
CREATE TRIGGER set_conversation_jobs_updated_at
BEFORE UPDATE ON public.conversation_jobs
FOR EACH ROW
EXECUTE FUNCTION public.set_conversation_jobs_updated_at();
