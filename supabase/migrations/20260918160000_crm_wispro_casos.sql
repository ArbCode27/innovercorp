-- Canonical CRM ficha for Wispro tickets: chat, facade photo, Maps link, technician.
-- Wispro remains source of truth for help-desk lifecycle; Nova and field techs read this table.

CREATE TABLE IF NOT EXISTS public.crm_wispro_casos (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  conversation_id bigint,
  crm_client_id bigint,
  wispro_client_id text,
  wispro_issue_id text NOT NULL,
  wispro_public_id integer,
  wispro_order_id text,
  employee_id text,
  employee_name text,
  employee_phone text,
  employee_phone_last10 text,
  status text NOT NULL DEFAULT 'open'
    CHECK (status IN ('open', 'scheduled', 'done', 'cancelled')),
  kind text,
  title text NOT NULL,
  cause text,
  description text,
  client_name text,
  client_phone text,
  maps_url text,
  latitude double precision,
  longitude double precision,
  address_text text,
  facade_media_url text,
  facade_message_id bigint,
  window_start timestamptz,
  window_end timestamptz,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT crm_wispro_casos_issue_unique UNIQUE (wispro_issue_id)
);

CREATE INDEX IF NOT EXISTS crm_wispro_casos_conversation_idx
  ON public.crm_wispro_casos (conversation_id)
  WHERE conversation_id IS NOT NULL;

CREATE INDEX IF NOT EXISTS crm_wispro_casos_crm_client_idx
  ON public.crm_wispro_casos (crm_client_id)
  WHERE crm_client_id IS NOT NULL;

CREATE INDEX IF NOT EXISTS crm_wispro_casos_employee_pending_idx
  ON public.crm_wispro_casos (employee_id, status)
  WHERE employee_id IS NOT NULL
    AND status IN ('open', 'scheduled');

CREATE INDEX IF NOT EXISTS crm_wispro_casos_phone_last10_idx
  ON public.crm_wispro_casos (employee_phone_last10)
  WHERE employee_phone_last10 IS NOT NULL
    AND status IN ('open', 'scheduled');

ALTER TABLE public.crm_wispro_casos ENABLE ROW LEVEL SECURITY;
