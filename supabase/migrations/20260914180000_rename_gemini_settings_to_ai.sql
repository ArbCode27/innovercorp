-- Rename legacy Gemini settings to provider-agnostic AI fields.
-- Safe to re-run.

DO $$
BEGIN
  IF EXISTS (
    SELECT 1
    FROM information_schema.columns
    WHERE table_schema = 'public'
      AND table_name = 'crm_settings'
      AND column_name = 'gemini_model'
  ) AND NOT EXISTS (
    SELECT 1
    FROM information_schema.columns
    WHERE table_schema = 'public'
      AND table_name = 'crm_settings'
      AND column_name = 'ai_model'
  ) THEN
    ALTER TABLE public.crm_settings RENAME COLUMN gemini_model TO ai_model;
  END IF;
END $$;

UPDATE public.crm_settings
SET bot_engine = 'ai'
WHERE bot_engine IS DISTINCT FROM 'ai';

UPDATE public.conversations
SET bot_engine = 'ai'
WHERE bot_engine IS NOT NULL
  AND bot_engine IS DISTINCT FROM 'ai';

-- Map retired Gemini model ids if still stored.
UPDATE public.crm_settings
SET ai_model = 'openai/gpt-oss-20b'
WHERE ai_model IS NULL
   OR ai_model = ''
   OR ai_model ILIKE 'gemini-%'
   OR ai_model = 'qwen/qwen3-32b';
