-- Persist dynamic office hours + after-hours payments policy for Nova.
-- Run in Supabase SQL editor (or via supabase db push).

ALTER TABLE public.crm_settings
  ADD COLUMN IF NOT EXISTS office_hours jsonb,
  ADD COLUMN IF NOT EXISTS after_hours_payments jsonb;

UPDATE public.crm_settings
SET
  office_hours = COALESCE(
    office_hours,
    '{
      "enabled": true,
      "timezone": "America/Caracas",
      "days": {
        "mon": [["08:00", "17:00"]],
        "tue": [["08:00", "17:00"]],
        "wed": [["08:00", "17:00"]],
        "thu": [["08:00", "17:00"]],
        "fri": [["08:00", "17:00"]],
        "sat": [["08:00", "12:00"]],
        "sun": []
      },
      "holidays": []
    }'::jsonb
  ),
  after_hours_payments = COALESCE(
    after_hours_payments,
    '{
      "enabled": true,
      "allowedTools": [
        "lookup_wispro_by_cedula",
        "submit_payment_receipt",
        "get_bcv_rate",
        "link_wispro_client"
      ]
    }'::jsonb
  )
WHERE id = 1;
