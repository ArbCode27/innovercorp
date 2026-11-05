-- Add approved_at timestamp to crm_payments for tracking approval time
-- and speeding up financial audits, queries and reports.

ALTER TABLE public.crm_payments
  ADD COLUMN IF NOT EXISTS approved_at timestamptz;

-- Backfill approved_at for previously approved payments from receipt_metadata or updated_at
UPDATE public.crm_payments
SET approved_at = COALESCE(
  NULLIF(receipt_metadata->>'approved_at', '')::timestamptz,
  NULLIF(receipt_metadata->>'manual_approved_at', '')::timestamptz,
  NULLIF(receipt_metadata->'wispro_payment'->>'registered_at', '')::timestamptz,
  updated_at
)
WHERE status = 'APROBADO'
  AND approved_at IS NULL;

-- Index for ordering and filtering approved payments by approval date
CREATE INDEX IF NOT EXISTS crm_payments_approved_at_idx
  ON public.crm_payments (approved_at DESC)
  WHERE status = 'APROBADO' AND approved_at IS NOT NULL;
