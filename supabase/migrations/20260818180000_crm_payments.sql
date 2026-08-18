-- CRM operational payments ledger (advisor inbox).
-- Complements the external Innover payments API; does not replace it.

CREATE EXTENSION IF NOT EXISTS pg_trgm;

CREATE TABLE IF NOT EXISTS public.crm_payments (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),

  client_id bigint REFERENCES public.clients(id) ON DELETE SET NULL,
  conversation_id bigint REFERENCES public.conversations(id) ON DELETE SET NULL,
  message_id bigint REFERENCES public.messages(id) ON DELETE SET NULL,
  submitted_by_agent_id bigint REFERENCES public.agents(id) ON DELETE SET NULL,

  wispro_client_id text,
  client_name text NOT NULL,
  cedula text NOT NULL,
  phone_id text,

  amount numeric(12, 2) NOT NULL CHECK (amount > 0),
  amount_raw text,
  bank text NOT NULL,
  transaction_code text NOT NULL,
  payment_date date NOT NULL DEFAULT CURRENT_DATE,
  comment text,

  status text NOT NULL DEFAULT 'EN_PROCESO'
    CHECK (status IN ('EN_PROCESO', 'APROBADO', 'RECHAZADO', 'DUPLICADO', 'ERROR')),

  source text NOT NULL DEFAULT 'ai'
    CHECK (source IN ('ai', 'advisor', 'manual', 'import', 'external_api')),

  external_payment_id text,
  external_api_status integer,
  external_response jsonb,
  error_message text,

  receipt_media_url text,
  receipt_metadata jsonb NOT NULL DEFAULT '{}'::jsonb,

  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),

  CONSTRAINT crm_payments_unique_reference
    UNIQUE (cedula, bank, transaction_code)
);

CREATE INDEX IF NOT EXISTS crm_payments_payment_date_idx
  ON public.crm_payments (payment_date DESC);

CREATE INDEX IF NOT EXISTS crm_payments_created_at_idx
  ON public.crm_payments (created_at DESC);

CREATE INDEX IF NOT EXISTS crm_payments_status_idx
  ON public.crm_payments (status);

CREATE INDEX IF NOT EXISTS crm_payments_bank_idx
  ON public.crm_payments (bank);

CREATE INDEX IF NOT EXISTS crm_payments_cedula_idx
  ON public.crm_payments (cedula);

CREATE INDEX IF NOT EXISTS crm_payments_client_id_idx
  ON public.crm_payments (client_id);

CREATE INDEX IF NOT EXISTS crm_payments_conversation_id_idx
  ON public.crm_payments (conversation_id);

CREATE INDEX IF NOT EXISTS crm_payments_client_name_trgm_idx
  ON public.crm_payments USING gin (client_name gin_trgm_ops);

CREATE INDEX IF NOT EXISTS crm_payments_cedula_trgm_idx
  ON public.crm_payments USING gin (cedula gin_trgm_ops);

CREATE OR REPLACE FUNCTION public.set_crm_payments_updated_at()
RETURNS trigger AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS set_crm_payments_updated_at ON public.crm_payments;

CREATE TRIGGER set_crm_payments_updated_at
BEFORE UPDATE ON public.crm_payments
FOR EACH ROW
EXECUTE FUNCTION public.set_crm_payments_updated_at();

DO $$
BEGIN
  ALTER PUBLICATION supabase_realtime ADD TABLE public.crm_payments;
EXCEPTION
  WHEN duplicate_object THEN NULL;
  WHEN undefined_object THEN NULL;
END $$;

ALTER TABLE public.crm_payments ENABLE ROW LEVEL SECURITY;
