
CREATE TABLE public.sap_payload_templates (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id uuid NULL,
  name text NOT NULL DEFAULT 'Business Partner Create',
  template jsonb NOT NULL,
  is_active boolean NOT NULL DEFAULT true,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

CREATE UNIQUE INDEX sap_payload_templates_tenant_unique
  ON public.sap_payload_templates (COALESCE(tenant_id, '00000000-0000-0000-0000-000000000000'::uuid))
  WHERE is_active = true;

ALTER TABLE public.sap_payload_templates ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Admins manage all sap payload templates"
  ON public.sap_payload_templates
  FOR ALL TO authenticated
  USING (has_role(auth.uid(), 'sharvi_admin'::app_role) OR has_role(auth.uid(), 'admin'::app_role))
  WITH CHECK (has_role(auth.uid(), 'sharvi_admin'::app_role) OR has_role(auth.uid(), 'admin'::app_role));

CREATE POLICY "Customer admins manage own tenant templates"
  ON public.sap_payload_templates
  FOR ALL TO authenticated
  USING (has_role(auth.uid(), 'customer_admin'::app_role) AND tenant_id IS NOT NULL AND user_belongs_to_tenant(auth.uid(), tenant_id))
  WITH CHECK (has_role(auth.uid(), 'customer_admin'::app_role) AND tenant_id IS NOT NULL AND user_belongs_to_tenant(auth.uid(), tenant_id));

CREATE POLICY "Tenant members read templates"
  ON public.sap_payload_templates
  FOR SELECT TO authenticated
  USING (
    tenant_id IS NULL
    OR user_belongs_to_tenant(auth.uid(), tenant_id)
    OR has_role(auth.uid(), 'sharvi_admin'::app_role)
    OR has_role(auth.uid(), 'admin'::app_role)
  );

CREATE TRIGGER update_sap_payload_templates_updated_at
  BEFORE UPDATE ON public.sap_payload_templates
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();
