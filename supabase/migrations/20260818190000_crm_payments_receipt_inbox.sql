-- CRM payments becomes the receipt inbox.
-- Rows can be created as soon as a comprobante arrives, even before OCR/extraction.

ALTER TABLE public.crm_payments
  ALTER COLUMN client_name DROP NOT NULL,
  ALTER COLUMN cedula DROP NOT NULL,
  ALTER COLUMN amount DROP NOT NULL,
  ALTER COLUMN bank DROP NOT NULL,
  ALTER COLUMN transaction_code DROP NOT NULL;

ALTER TABLE public.crm_payments
  DROP CONSTRAINT IF EXISTS crm_payments_amount_check;

ALTER TABLE public.crm_payments
  ADD CONSTRAINT crm_payments_amount_check
  CHECK (amount IS NULL OR amount > 0);

ALTER TABLE public.crm_payments
  DROP CONSTRAINT IF EXISTS crm_payments_status_check;

ALTER TABLE public.crm_payments
  ADD CONSTRAINT crm_payments_status_check
  CHECK (status IN ('RECIBIDO', 'EN_PROCESO', 'APROBADO', 'RECHAZADO', 'DUPLICADO', 'ERROR'));

ALTER TABLE public.crm_payments
  ALTER COLUMN status SET DEFAULT 'RECIBIDO';

ALTER TABLE public.crm_payments
  DROP CONSTRAINT IF EXISTS crm_payments_unique_reference;

CREATE UNIQUE INDEX IF NOT EXISTS crm_payments_message_id_unique
  ON public.crm_payments (message_id)
  WHERE message_id IS NOT NULL;

CREATE UNIQUE INDEX IF NOT EXISTS crm_payments_unique_reference_extracted
  ON public.crm_payments (cedula, bank, transaction_code)
  WHERE cedula IS NOT NULL
    AND bank IS NOT NULL
    AND transaction_code IS NOT NULL;
