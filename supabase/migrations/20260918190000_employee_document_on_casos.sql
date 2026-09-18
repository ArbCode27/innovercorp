-- CRM technician assignment is keyed by Wispro employee + cédula digits.
-- Nova lists pending tickets by employee_id or by the technician's document.

ALTER TABLE public.crm_wispro_casos
  ADD COLUMN IF NOT EXISTS employee_document text,
  ADD COLUMN IF NOT EXISTS employee_document_digits text;

CREATE INDEX IF NOT EXISTS crm_wispro_casos_employee_document_pending_idx
  ON public.crm_wispro_casos (employee_document_digits)
  WHERE employee_document_digits IS NOT NULL
    AND status IN ('open', 'scheduled');
