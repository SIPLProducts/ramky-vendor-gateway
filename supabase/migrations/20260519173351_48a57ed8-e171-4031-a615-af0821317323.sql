DO $$
DECLARE r RECORD;
BEGIN
  FOR r IN
    SELECT conname FROM pg_constraint
    WHERE conrelid = 'public.buyer_scm_mappings'::regclass AND contype = 'u'
  LOOP
    EXECUTE format('ALTER TABLE public.buyer_scm_mappings DROP CONSTRAINT %I', r.conname);
  END LOOP;
END $$;

ALTER TABLE public.buyer_scm_mappings
  ADD CONSTRAINT buyer_scm_mappings_tenant_buyer_unique UNIQUE (tenant_id, buyer_user_id);