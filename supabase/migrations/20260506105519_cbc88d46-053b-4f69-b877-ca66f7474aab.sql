CREATE TABLE public.buyer_scm_mappings (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id uuid NOT NULL REFERENCES public.tenants(id) ON DELETE CASCADE,
  buyer_user_id uuid NOT NULL,
  scm_manager_user_id uuid NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now(),
  created_by uuid,
  UNIQUE (tenant_id, buyer_user_id, scm_manager_user_id)
);

ALTER TABLE public.buyer_scm_mappings ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Admins manage buyer-scm mappings"
ON public.buyer_scm_mappings FOR ALL TO authenticated
USING (has_role(auth.uid(),'sharvi_admin'::app_role) OR has_role(auth.uid(),'admin'::app_role))
WITH CHECK (has_role(auth.uid(),'sharvi_admin'::app_role) OR has_role(auth.uid(),'admin'::app_role));

CREATE POLICY "Customer admins manage own tenant buyer-scm mappings"
ON public.buyer_scm_mappings FOR ALL TO authenticated
USING (has_role(auth.uid(),'customer_admin'::app_role) AND user_belongs_to_tenant(auth.uid(), tenant_id))
WITH CHECK (has_role(auth.uid(),'customer_admin'::app_role) AND user_belongs_to_tenant(auth.uid(), tenant_id));

CREATE POLICY "Mapped users can read own mappings"
ON public.buyer_scm_mappings FOR SELECT TO authenticated
USING (buyer_user_id = auth.uid() OR scm_manager_user_id = auth.uid());