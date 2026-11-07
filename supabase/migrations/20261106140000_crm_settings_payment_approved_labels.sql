-- Add payment_approved_label_ids to crm_settings
-- Allows configuring which labels are automatically assigned to conversations on payment approval.

ALTER TABLE public.crm_settings
  ADD COLUMN IF NOT EXISTS payment_approved_label_ids integer[] DEFAULT '{}';
