-- Allow the same Wispro customer on multiple CRM chats (WhatsApp identities).
-- wispro_id is many-to-one: several clients rows may share one Wispro id.

DO $$
DECLARE
  rec record;
BEGIN
  FOR rec IN
    SELECT c.conname
    FROM pg_constraint c
    JOIN pg_class t ON t.oid = c.conrelid
    JOIN pg_namespace n ON n.oid = t.relnamespace
    WHERE n.nspname = 'public'
      AND t.relname = 'clients'
      AND c.contype = 'u'
      AND pg_get_constraintdef(c.oid) ILIKE '%wispro_id%'
  LOOP
    EXECUTE format('ALTER TABLE public.clients DROP CONSTRAINT IF EXISTS %I', rec.conname);
  END LOOP;

  FOR rec IN
    SELECT i.relname AS indexname
    FROM pg_index x
    JOIN pg_class t ON t.oid = x.indrelid
    JOIN pg_class i ON i.oid = x.indexrelid
    JOIN pg_namespace n ON n.oid = t.relnamespace
    JOIN pg_attribute a ON a.attrelid = t.oid AND a.attnum = ANY (x.indkey)
    WHERE n.nspname = 'public'
      AND t.relname = 'clients'
      AND x.indisunique
      AND a.attname = 'wispro_id'
      AND NOT x.indisprimary
  LOOP
    EXECUTE format('DROP INDEX IF EXISTS public.%I', rec.indexname);
  END LOOP;
END $$;

CREATE INDEX IF NOT EXISTS clients_wispro_id_idx
  ON public.clients (wispro_id)
  WHERE wispro_id IS NOT NULL;

DO $$
BEGIN
  IF EXISTS (
    SELECT 1
    FROM information_schema.columns
    WHERE table_schema = 'public'
      AND table_name = 'clients'
      AND column_name = 'organization_id'
  ) THEN
    EXECUTE $sql$
      CREATE INDEX IF NOT EXISTS clients_organization_wispro_id_idx
        ON public.clients (organization_id, wispro_id)
        WHERE wispro_id IS NOT NULL
    $sql$;
  END IF;
END $$;
