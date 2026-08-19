ALTER TABLE public.crm_settings
  ADD COLUMN IF NOT EXISTS payment_success_message text;
