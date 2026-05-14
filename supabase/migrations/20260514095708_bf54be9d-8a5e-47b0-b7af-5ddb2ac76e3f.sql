
CREATE TABLE IF NOT EXISTS public.sap_master_data (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  master_type text NOT NULL,
  code text NOT NULL,
  description text,
  extra jsonb DEFAULT '{}'::jsonb,
  source text NOT NULL DEFAULT 'manual',
  last_synced_at timestamptz,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (master_type, code)
);

CREATE INDEX IF NOT EXISTS idx_sap_master_data_type ON public.sap_master_data(master_type);

ALTER TABLE public.sap_master_data ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Authenticated users can read SAP master data"
  ON public.sap_master_data FOR SELECT
  TO authenticated USING (true);

CREATE POLICY "Admins can insert SAP master data"
  ON public.sap_master_data FOR INSERT
  TO authenticated
  WITH CHECK (
    has_role(auth.uid(), 'admin'::app_role)
    OR has_role(auth.uid(), 'sharvi_admin'::app_role)
    OR has_role(auth.uid(), 'customer_admin'::app_role)
  );

CREATE POLICY "Admins can update SAP master data"
  ON public.sap_master_data FOR UPDATE
  TO authenticated
  USING (
    has_role(auth.uid(), 'admin'::app_role)
    OR has_role(auth.uid(), 'sharvi_admin'::app_role)
    OR has_role(auth.uid(), 'customer_admin'::app_role)
  );

CREATE POLICY "Admins can delete SAP master data"
  ON public.sap_master_data FOR DELETE
  TO authenticated
  USING (
    has_role(auth.uid(), 'admin'::app_role)
    OR has_role(auth.uid(), 'sharvi_admin'::app_role)
    OR has_role(auth.uid(), 'customer_admin'::app_role)
  );

CREATE TRIGGER sap_master_data_updated_at
  BEFORE UPDATE ON public.sap_master_data
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

INSERT INTO public.sap_master_data (master_type, code, description, source)
VALUES ('vendor_account_group', '0001', 'Vendor', 'manual')
ON CONFLICT (master_type, code) DO NOTHING;
