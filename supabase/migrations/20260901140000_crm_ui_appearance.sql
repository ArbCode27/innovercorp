-- Persist CRM appearance: office default accent + per-agent accent/mode.
-- Run in Supabase SQL editor (or via supabase db push).

ALTER TABLE public.crm_settings
  ADD COLUMN IF NOT EXISTS ui_accent text NOT NULL DEFAULT 'blue';

ALTER TABLE public.crm_settings
  DROP CONSTRAINT IF EXISTS crm_settings_ui_accent_check;

ALTER TABLE public.crm_settings
  ADD CONSTRAINT crm_settings_ui_accent_check
  CHECK (ui_accent IN ('rose', 'violet', 'blue', 'amber', 'emerald', 'teal'));

UPDATE public.crm_settings
SET ui_accent = 'blue'
WHERE id = 1 AND (ui_accent IS NULL OR ui_accent = '');

ALTER TABLE public.agents
  ADD COLUMN IF NOT EXISTS ui_accent text,
  ADD COLUMN IF NOT EXISTS ui_mode text;

ALTER TABLE public.agents
  DROP CONSTRAINT IF EXISTS agents_ui_accent_check;

ALTER TABLE public.agents
  ADD CONSTRAINT agents_ui_accent_check
  CHECK (
    ui_accent IS NULL
    OR ui_accent IN ('rose', 'violet', 'blue', 'amber', 'emerald', 'teal')
  );

ALTER TABLE public.agents
  DROP CONSTRAINT IF EXISTS agents_ui_mode_check;

ALTER TABLE public.agents
  ADD CONSTRAINT agents_ui_mode_check
  CHECK (ui_mode IS NULL OR ui_mode IN ('light', 'dark', 'system'));
