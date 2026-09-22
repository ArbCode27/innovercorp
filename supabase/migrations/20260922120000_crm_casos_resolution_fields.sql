-- Add structured resolution and quality control fields to crm_wispro_casos
-- Ensures technicians provide observation, solution, and client status before ticket closing.

ALTER TABLE public.crm_wispro_casos
  ADD COLUMN IF NOT EXISTS resolution_observation text,
  ADD COLUMN IF NOT EXISTS resolution_solution text,
  ADD COLUMN IF NOT EXISTS client_status text;

-- Index for auditing client satisfaction & service status upon closure
CREATE INDEX IF NOT EXISTS crm_wispro_casos_client_status_idx
  ON public.crm_wispro_casos (client_status)
  WHERE client_status IS NOT NULL;
