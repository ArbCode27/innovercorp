-- Standalone tickets and technician management.
-- Decouples tickets from external Wispro API and enables local technician management.

-- 1. Sequence and defaults for tickets
CREATE SEQUENCE IF NOT EXISTS public.crm_tickets_public_id_seq START WITH 2000;

-- Function to advance and fetch next ticket public_id
CREATE OR REPLACE FUNCTION public.nextval_crm_tickets_public_id()
RETURNS bigint AS $$
BEGIN
  RETURN nextval('public.crm_tickets_public_id_seq');
END;
$$ LANGUAGE plpgsql;

-- Trigger to guarantee public_id and issue_id defaults on crm_wispro_casos
CREATE OR REPLACE FUNCTION public.set_crm_wispro_caso_defaults()
RETURNS trigger AS $$
BEGIN
  IF NEW.wispro_issue_id IS NULL OR NEW.wispro_issue_id = '' THEN
    NEW.wispro_issue_id := gen_random_uuid()::text;
  END IF;

  IF NEW.wispro_public_id IS NULL OR NEW.wispro_public_id <= 0 THEN
    NEW.wispro_public_id := nextval('public.crm_tickets_public_id_seq');
  END IF;

  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS trigger_set_crm_wispro_caso_defaults ON public.crm_wispro_casos;
CREATE TRIGGER trigger_set_crm_wispro_caso_defaults
  BEFORE INSERT ON public.crm_wispro_casos
  FOR EACH ROW
  EXECUTE FUNCTION public.set_crm_wispro_caso_defaults();

-- Sync sequence to max existing public_id if any exists
DO $$
DECLARE
  max_id integer;
BEGIN
  SELECT MAX(wispro_public_id) INTO max_id FROM public.crm_wispro_casos;
  IF max_id IS NOT NULL AND max_id >= 2000 THEN
    PERFORM setval('public.crm_tickets_public_id_seq', max_id + 1, false);
  END IF;
END $$;

-- 2. Enhance crm_technicians to support full standalone CRUD
ALTER TABLE public.crm_technicians
  ALTER COLUMN employee_id SET DEFAULT gen_random_uuid()::text,
  ADD COLUMN IF NOT EXISTS document text,
  ADD COLUMN IF NOT EXISTS notes text,
  ADD COLUMN IF NOT EXISTS created_by bigint REFERENCES public.agents(id);

CREATE INDEX IF NOT EXISTS crm_technicians_active_name_idx
  ON public.crm_technicians (name)
  WHERE active;
