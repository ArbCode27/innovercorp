-- Prevent orphan empty conversations and duplicate active threads per client.
-- Run in Supabase SQL editor (or via supabase db push) before relying on race recovery.

-- 1) Remove conversations with zero messages (true orphans).
DELETE FROM public.conversations c
WHERE NOT EXISTS (
  SELECT 1
  FROM public.messages m
  WHERE m.conversation_id = c.id
);

-- 2) For clients with multiple active conversations, keep the best one:
--    prefer the one with the latest last_message_at / updated_at that still has messages.
WITH ranked AS (
  SELECT
    c.id,
    c.client_id,
    ROW_NUMBER() OVER (
      PARTITION BY c.client_id
      ORDER BY
        COALESCE(c.last_message_at, c.updated_at, c.created_at) DESC NULLS LAST,
        c.id DESC
    ) AS rn
  FROM public.conversations c
  WHERE c.status IN ('abierto', 'proceso')
),
duplicates AS (
  SELECT id
  FROM ranked
  WHERE rn > 1
)
UPDATE public.conversations
SET
  status = 'resuelto',
  updated_at = NOW()
WHERE id IN (SELECT id FROM duplicates);

-- 3) Enforce at most one active conversation per client going forward.
CREATE UNIQUE INDEX IF NOT EXISTS conversations_one_active_per_client_idx
ON public.conversations (client_id)
WHERE status IN ('abierto', 'proceso');

-- Optional verification (read-only):
-- SELECT c.id, c.client_id, c.status, c.human_mode, c.preview
-- FROM public.conversations c
-- LEFT JOIN public.messages m ON m.conversation_id = c.id
-- GROUP BY c.id
-- HAVING COUNT(m.id) = 0;
