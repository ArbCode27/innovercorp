-- Un historial por cliente + índice de teléfono para números sin client_id.
-- Ejecutar en Supabase SQL Editor si aún no aplicaste estos cambios.

CREATE UNIQUE INDEX IF NOT EXISTS idx_conversation_history_client_unique
  ON public.conversation_history (client_id)
  WHERE client_id IS NOT NULL;

CREATE INDEX IF NOT EXISTS idx_conversation_history_client_phone
  ON public.conversation_history (client_phone)
  WHERE client_id IS NULL AND client_phone IS NOT NULL;

-- Fusionar historiales duplicados existentes (conserva el registro más antiguo).
WITH ranked AS (
  SELECT
    id,
    client_id,
    ROW_NUMBER() OVER (
      PARTITION BY client_id
      ORDER BY id ASC
    ) AS row_number
  FROM public.conversation_history
  WHERE client_id IS NOT NULL
),
duplicates AS (
  SELECT id AS duplicate_id, client_id
  FROM ranked
  WHERE row_number > 1
),
canonical AS (
  SELECT client_id, MIN(id) AS canonical_id
  FROM public.conversation_history
  WHERE client_id IS NOT NULL
  GROUP BY client_id
  HAVING COUNT(*) > 1
)
UPDATE public.history_messages hm
SET history_id = c.canonical_id
FROM duplicates d
JOIN canonical c ON c.client_id = d.client_id
WHERE hm.history_id = d.duplicate_id;

WITH ranked AS (
  SELECT
    id,
    client_id,
    total_messages,
    first_message_at,
    last_message_at,
    resolved_at,
    ROW_NUMBER() OVER (
      PARTITION BY client_id
      ORDER BY id ASC
    ) AS row_number
  FROM public.conversation_history
  WHERE client_id IS NOT NULL
),
canonical AS (
  SELECT
    client_id,
    MIN(id) AS canonical_id,
    SUM(total_messages) AS merged_total,
    MIN(first_message_at) AS merged_first,
    MAX(last_message_at) AS merged_last,
    MAX(resolved_at) AS merged_resolved
  FROM ranked
  GROUP BY client_id
  HAVING COUNT(*) > 1
)
UPDATE public.conversation_history ch
SET
  total_messages = c.merged_total,
  first_message_at = c.merged_first,
  last_message_at = c.merged_last,
  resolved_at = c.merged_resolved
FROM canonical c
WHERE ch.id = c.canonical_id;

DELETE FROM public.conversation_history ch
USING (
  SELECT id
  FROM (
    SELECT
      id,
      ROW_NUMBER() OVER (
        PARTITION BY client_id
        ORDER BY id ASC
      ) AS row_number
    FROM public.conversation_history
    WHERE client_id IS NOT NULL
  ) ranked
  WHERE row_number > 1
) duplicates
WHERE ch.id = duplicates.id;
