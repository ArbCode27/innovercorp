-- Canonical managers / supervisors table for WhatsApp bot access to technician tickets.
-- Active managers are identified by phone_last10 and granted the supervisor_wispro role.

CREATE TABLE IF NOT EXISTS public.crm_supervisors (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  name text NOT NULL,
  phone_last10 text NOT NULL,
  wispro_employee_id text,
  active boolean NOT NULL DEFAULT true,
  created_by bigint,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

-- Ensure only one active supervisor can own a given 10-digit phone number.
CREATE UNIQUE INDEX IF NOT EXISTS crm_supervisors_phone_last10_active_uidx
  ON public.crm_supervisors (phone_last10)
  WHERE active;

CREATE INDEX IF NOT EXISTS crm_supervisors_active_idx
  ON public.crm_supervisors (active);

-- Seed initial manager phone number (editable from CRM UI)
INSERT INTO public.crm_supervisors (name, phone_last10, active)
VALUES ('Gerente de Operaciones', '4142132785', true)
ON CONFLICT DO NOTHING;

ALTER TABLE public.crm_supervisors ENABLE ROW LEVEL SECURITY;
