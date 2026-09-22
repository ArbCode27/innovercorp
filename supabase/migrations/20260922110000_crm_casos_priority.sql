-- Add priority column to crm_wispro_casos
-- Allowed values: low, medium, high, urgent. Default: medium.

ALTER TABLE public.crm_wispro_casos
  ADD COLUMN IF NOT EXISTS priority text NOT NULL DEFAULT 'medium'
  CHECK (priority IN ('low', 'medium', 'high', 'urgent'));

-- Index for filtering and sorting tickets by priority
CREATE INDEX IF NOT EXISTS crm_wispro_casos_priority_idx
  ON public.crm_wispro_casos (priority);
