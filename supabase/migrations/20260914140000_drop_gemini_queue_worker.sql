-- Remove Gemini queue / worker tables (replies now run via after() in the WhatsApp webhook).
-- Does not drop shared pgmq RPCs (queue_send/read/delete) or the gemini_messages queue;
-- drop those manually in SQL Editor if nothing else uses them.

DROP TRIGGER IF EXISTS set_conversation_jobs_updated_at ON public.conversation_jobs;
DROP FUNCTION IF EXISTS public.set_conversation_jobs_updated_at();

DROP TABLE IF EXISTS public.conversation_jobs_dead_letter;
DROP TABLE IF EXISTS public.conversation_jobs;
DROP TABLE IF EXISTS public.worker_runs;
