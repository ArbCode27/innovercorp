-- Add closed_at timestamp and resolution_notes to crm_wispro_casos
-- for tracking actual ticket completion date, SLA, and technician performance metrics.

ALTER TABLE public.crm_wispro_casos
  ADD COLUMN IF NOT EXISTS closed_at timestamptz,
  ADD COLUMN IF NOT EXISTS resolution_notes text;

-- Backfill closed_at for existing done/cancelled cases using updated_at
UPDATE public.crm_wispro_casos
SET closed_at = updated_at
WHERE status IN ('done', 'cancelled')
  AND closed_at IS NULL;

-- Index for ordering technician tickets by scheduled window
CREATE INDEX IF NOT EXISTS crm_wispro_casos_employee_window_idx
  ON public.crm_wispro_casos (employee_id, window_start ASC)
  WHERE employee_id IS NOT NULL;

-- Index for technician performance metrics by resolution date
CREATE INDEX IF NOT EXISTS crm_wispro_casos_employee_closed_at_idx
  ON public.crm_wispro_casos (employee_id, closed_at DESC)
  WHERE status = 'done' AND closed_at IS NOT NULL;

-- Index for general status & closed date queries
CREATE INDEX IF NOT EXISTS crm_wispro_casos_status_closed_at_idx
  ON public.crm_wispro_casos (status, closed_at DESC);
