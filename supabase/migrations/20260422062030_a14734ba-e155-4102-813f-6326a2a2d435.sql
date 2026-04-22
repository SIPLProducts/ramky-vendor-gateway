-- 1) form_step_configs table
CREATE TABLE IF NOT EXISTS public.form_step_configs (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id uuid REFERENCES public.tenants(id) ON DELETE CASCADE,
  step_key text NOT NULL,
  step_label text NOT NULL,
  step_description text,
  step_order integer NOT NULL DEFAULT 1,
  is_visible boolean NOT NULL DEFAULT true,
  is_built_in boolean NOT NULL DEFAULT false,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (tenant_id, step_key)
);

CREATE INDEX IF NOT EXISTS idx_form_step_configs_tenant ON public.form_step_configs(tenant_id);

ALTER TABLE public.form_step_configs ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Sharvi admins manage all step configs"
  ON public.form_step_configs
  FOR ALL
  TO authenticated
  USING (public.has_role(auth.uid(), 'sharvi_admin'::app_role) OR public.has_role(auth.uid(), 'admin'::app_role))
  WITH CHECK (public.has_role(auth.uid(), 'sharvi_admin'::app_role) OR public.has_role(auth.uid(), 'admin'::app_role));

CREATE POLICY "Customer admins manage own tenant step configs"
  ON public.form_step_configs
  FOR ALL
  TO authenticated
  USING (
    public.has_role(auth.uid(), 'customer_admin'::app_role)
    AND tenant_id IS NOT NULL
    AND public.user_belongs_to_tenant(auth.uid(), tenant_id)
  )
  WITH CHECK (
    public.has_role(auth.uid(), 'customer_admin'::app_role)
    AND tenant_id IS NOT NULL
    AND public.user_belongs_to_tenant(auth.uid(), tenant_id)
  );

CREATE POLICY "Authenticated read tenant step configs"
  ON public.form_step_configs
  FOR SELECT
  TO authenticated
  USING (
    tenant_id IS NULL
    OR tenant_id IN (SELECT public.user_tenant_ids(auth.uid()))
    OR public.has_role(auth.uid(), 'sharvi_admin'::app_role)
    OR public.has_role(auth.uid(), 'admin'::app_role)
  );

-- updated_at trigger
DROP TRIGGER IF EXISTS trg_form_step_configs_updated_at ON public.form_step_configs;
CREATE TRIGGER trg_form_step_configs_updated_at
BEFORE UPDATE ON public.form_step_configs
FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

-- 2) Custom field values on vendors
ALTER TABLE public.vendors
  ADD COLUMN IF NOT EXISTS custom_field_values jsonb NOT NULL DEFAULT '{}'::jsonb;