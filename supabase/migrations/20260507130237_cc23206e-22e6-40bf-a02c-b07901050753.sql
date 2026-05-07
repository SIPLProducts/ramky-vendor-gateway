
CREATE TABLE IF NOT EXISTS public.sap_default_fields (
  tenant_id uuid PRIMARY KEY,
  partn_cat text NOT NULL DEFAULT '2',
  partn_grp text NOT NULL DEFAULT 'ZDOM',
  title text NOT NULL DEFAULT '0003',
  taxtype text NOT NULL DEFAULT 'IN3',
  bukrs text NOT NULL DEFAULT '1000',
  akont text NOT NULL DEFAULT '155000005',
  zuawa text NOT NULL DEFAULT '014',
  fdgrv text NOT NULL DEFAULT 'A1',
  vkorg text NOT NULL DEFAULT '1000',
  waers text NOT NULL DEFAULT 'INR',
  kalsk text NOT NULL DEFAULT 'L1',
  cdi text NOT NULL DEFAULT 'X',
  webre text NOT NULL DEFAULT 'X',
  lebre text NOT NULL DEFAULT 'X',
  ven_class text NOT NULL DEFAULT '',
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

ALTER TABLE public.sap_default_fields ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Tenant members can read sap defaults"
ON public.sap_default_fields FOR SELECT
TO authenticated
USING (
  user_belongs_to_tenant(auth.uid(), tenant_id)
  OR has_role(auth.uid(), 'sharvi_admin'::app_role)
  OR has_role(auth.uid(), 'admin'::app_role)
);

CREATE POLICY "Customer admins manage own tenant sap defaults"
ON public.sap_default_fields FOR ALL
TO authenticated
USING (has_role(auth.uid(), 'customer_admin'::app_role) AND user_belongs_to_tenant(auth.uid(), tenant_id))
WITH CHECK (has_role(auth.uid(), 'customer_admin'::app_role) AND user_belongs_to_tenant(auth.uid(), tenant_id));

CREATE POLICY "Admins manage all sap defaults"
ON public.sap_default_fields FOR ALL
TO authenticated
USING (has_role(auth.uid(), 'sharvi_admin'::app_role) OR has_role(auth.uid(), 'admin'::app_role))
WITH CHECK (has_role(auth.uid(), 'sharvi_admin'::app_role) OR has_role(auth.uid(), 'admin'::app_role));

CREATE TRIGGER update_sap_default_fields_updated_at
BEFORE UPDATE ON public.sap_default_fields
FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

-- Seed defaults for every existing tenant
INSERT INTO public.sap_default_fields (tenant_id)
SELECT id FROM public.tenants
ON CONFLICT (tenant_id) DO NOTHING;

-- Vendor extra columns
ALTER TABLE public.vendors
  ADD COLUMN IF NOT EXISTS relative_name text,
  ADD COLUMN IF NOT EXISTS account_holder_name text;
