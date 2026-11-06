-- Backfill approved_at for any approved payments where approved_at is NULL.
-- This repairs payments approved while the application code had not yet
-- included the approved_at column in its update payload.

UPDATE public.crm_payments
SET approved_at = COALESCE(
  NULLIF(receipt_metadata->>'approved_at', '')::timestamptz,
  NULLIF(receipt_metadata->>'manual_approved_at', '')::timestamptz,
  NULLIF(receipt_metadata->'wispro_payment'->>'registered_at', '')::timestamptz,
  NULLIF(receipt_metadata->>'registered_at', '')::timestamptz,
  updated_at
)
WHERE status = 'APROBADO'
  AND approved_at IS NULL;
