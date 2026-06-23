-- Wispro integration (only if wispro_id column is missing)
ALTER TABLE clients ADD COLUMN IF NOT EXISTS wispro_id text;

CREATE UNIQUE INDEX IF NOT EXISTS clients_wispro_id_unique
  ON clients (wispro_id)
  WHERE wispro_id IS NOT NULL;
