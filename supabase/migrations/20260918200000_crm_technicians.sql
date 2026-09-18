-- Canonical technician catalog for WhatsApp identification.
-- Wispro remains the source of employees; this table is the CRM cache + verified WhatsApp binding.
-- crm_wispro_casos.employee_document_digits stays as a denormalized fallback, not the catalog.

CREATE TABLE IF NOT EXISTS public.crm_technicians (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  employee_id text NOT NULL,
  name text NOT NULL,
  document_hash text,
  document_last4 text,
  phone_e164 text,
  phone_last10 text,
  whatsapp_phone_e164 text,
  whatsapp_phone_last10 text,
  whatsapp_verified_at timestamptz,
  whatsapp_verification_method text,
  active boolean NOT NULL DEFAULT true,
  source_updated_at timestamptz,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT crm_technicians_employee_unique UNIQUE (employee_id)
);

CREATE UNIQUE INDEX IF NOT EXISTS crm_technicians_document_hash_uidx
  ON public.crm_technicians (document_hash)
  WHERE document_hash IS NOT NULL AND active;

CREATE UNIQUE INDEX IF NOT EXISTS crm_technicians_whatsapp_last10_uidx
  ON public.crm_technicians (whatsapp_phone_last10)
  WHERE whatsapp_phone_last10 IS NOT NULL AND active;

CREATE INDEX IF NOT EXISTS crm_technicians_phone_last10_idx
  ON public.crm_technicians (phone_last10)
  WHERE phone_last10 IS NOT NULL AND active;

CREATE TABLE IF NOT EXISTS public.crm_technician_challenges (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  technician_id uuid NOT NULL REFERENCES public.crm_technicians(id) ON DELETE CASCADE,
  conversation_id bigint NOT NULL,
  whatsapp_phone_last10 text NOT NULL,
  code_hash text NOT NULL,
  expires_at timestamptz NOT NULL,
  consumed_at timestamptz,
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS crm_technician_challenges_open_idx
  ON public.crm_technician_challenges (conversation_id, expires_at)
  WHERE consumed_at IS NULL;

CREATE TABLE IF NOT EXISTS public.crm_technician_events (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  technician_id uuid REFERENCES public.crm_technicians(id) ON DELETE SET NULL,
  conversation_id bigint,
  event text NOT NULL,
  method text,
  metadata jsonb NOT NULL DEFAULT '{}'::jsonb,
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS crm_technician_events_conversation_idx
  ON public.crm_technician_events (conversation_id, created_at DESC);

ALTER TABLE public.conversations
  ADD COLUMN IF NOT EXISTS actor_type text NOT NULL DEFAULT 'customer',
  ADD COLUMN IF NOT EXISTS technician_id uuid REFERENCES public.crm_technicians(id),
  ADD COLUMN IF NOT EXISTS technician_employee_id text,
  ADD COLUMN IF NOT EXISTS technician_verified_at timestamptz,
  ADD COLUMN IF NOT EXISTS technician_verification_method text,
  ADD COLUMN IF NOT EXISTS technician_report_offset integer NOT NULL DEFAULT 0;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1
    FROM pg_constraint
    WHERE conname = 'conversations_actor_type_check'
  ) THEN
    ALTER TABLE public.conversations
      ADD CONSTRAINT conversations_actor_type_check
      CHECK (actor_type IN ('customer', 'technician'));
  END IF;
END $$;

CREATE INDEX IF NOT EXISTS conversations_technician_id_idx
  ON public.conversations (technician_id)
  WHERE technician_id IS NOT NULL;

ALTER TABLE public.crm_wispro_casos
  ADD COLUMN IF NOT EXISTS last_technician_report_at timestamptz,
  ADD COLUMN IF NOT EXISTS last_technician_report_key text;

ALTER TABLE public.crm_technicians ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.crm_technician_challenges ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.crm_technician_events ENABLE ROW LEVEL SECURITY;
