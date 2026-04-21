-- Approval matrix levels
CREATE TABLE public.approval_matrix_levels (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id uuid NOT NULL REFERENCES public.tenants(id) ON DELETE CASCADE,
  level_number int NOT NULL,
  level_name text NOT NULL,
  designation text,
  approval_mode text NOT NULL DEFAULT 'ANY' CHECK (approval_mode IN ('ANY','ALL')),
  is_active boolean NOT NULL DEFAULT true,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE(tenant_id, level_number)
);

CREATE INDEX idx_aml_tenant ON public.approval_matrix_levels(tenant_id);

ALTER TABLE public.approval_matrix_levels ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Sharvi admins manage all levels"
  ON public.approval_matrix_levels FOR ALL TO authenticated
  USING (has_role(auth.uid(),'sharvi_admin') OR has_role(auth.uid(),'admin'))
  WITH CHECK (has_role(auth.uid(),'sharvi_admin') OR has_role(auth.uid(),'admin'));

CREATE POLICY "Customer admins manage own tenant levels"
  ON public.approval_matrix_levels FOR ALL TO authenticated
  USING (has_role(auth.uid(),'customer_admin') AND user_belongs_to_tenant(auth.uid(), tenant_id))
  WITH CHECK (has_role(auth.uid(),'customer_admin') AND user_belongs_to_tenant(auth.uid(), tenant_id));

CREATE POLICY "Authenticated can read levels"
  ON public.approval_matrix_levels FOR SELECT TO authenticated
  USING (true);

CREATE TRIGGER trg_aml_updated
  BEFORE UPDATE ON public.approval_matrix_levels
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

-- Approvers per level
CREATE TABLE public.approval_matrix_approvers (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  level_id uuid NOT NULL REFERENCES public.approval_matrix_levels(id) ON DELETE CASCADE,
  user_id uuid NOT NULL,
  added_by uuid,
  added_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE(level_id, user_id)
);

CREATE INDEX idx_ama_level ON public.approval_matrix_approvers(level_id);
CREATE INDEX idx_ama_user ON public.approval_matrix_approvers(user_id);

ALTER TABLE public.approval_matrix_approvers ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Sharvi admins manage all approvers"
  ON public.approval_matrix_approvers FOR ALL TO authenticated
  USING (has_role(auth.uid(),'sharvi_admin') OR has_role(auth.uid(),'admin'))
  WITH CHECK (has_role(auth.uid(),'sharvi_admin') OR has_role(auth.uid(),'admin'));

CREATE POLICY "Customer admins manage own tenant approvers"
  ON public.approval_matrix_approvers FOR ALL TO authenticated
  USING (
    has_role(auth.uid(),'customer_admin') AND EXISTS (
      SELECT 1 FROM public.approval_matrix_levels l
      WHERE l.id = level_id AND user_belongs_to_tenant(auth.uid(), l.tenant_id)
    )
  )
  WITH CHECK (
    has_role(auth.uid(),'customer_admin') AND EXISTS (
      SELECT 1 FROM public.approval_matrix_levels l
      WHERE l.id = level_id AND user_belongs_to_tenant(auth.uid(), l.tenant_id)
    )
  );

CREATE POLICY "Authenticated can read approvers"
  ON public.approval_matrix_approvers FOR SELECT TO authenticated
  USING (true);

-- Vendor approval progress
CREATE TABLE public.vendor_approval_progress (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  vendor_id uuid NOT NULL REFERENCES public.vendors(id) ON DELETE CASCADE,
  level_id uuid NOT NULL REFERENCES public.approval_matrix_levels(id) ON DELETE CASCADE,
  level_number int NOT NULL,
  status text NOT NULL DEFAULT 'pending' CHECK (status IN ('pending','approved','rejected','skipped','waiting')),
  acted_by uuid,
  acted_at timestamptz,
  comments text,
  created_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE(vendor_id, level_id)
);

CREATE INDEX idx_vap_vendor ON public.vendor_approval_progress(vendor_id);
CREATE INDEX idx_vap_level ON public.vendor_approval_progress(level_id);
CREATE INDEX idx_vap_status ON public.vendor_approval_progress(status);

ALTER TABLE public.vendor_approval_progress ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Admins manage all progress"
  ON public.vendor_approval_progress FOR ALL TO authenticated
  USING (has_role(auth.uid(),'sharvi_admin') OR has_role(auth.uid(),'admin'))
  WITH CHECK (has_role(auth.uid(),'sharvi_admin') OR has_role(auth.uid(),'admin'));

CREATE POLICY "Finance and purchase view progress"
  ON public.vendor_approval_progress FOR SELECT TO authenticated
  USING (has_role(auth.uid(),'finance') OR has_role(auth.uid(),'purchase'));

CREATE POLICY "Approvers view their level progress"
  ON public.vendor_approval_progress FOR SELECT TO authenticated
  USING (EXISTS (
    SELECT 1 FROM public.approval_matrix_approvers a
    WHERE a.level_id = vendor_approval_progress.level_id AND a.user_id = auth.uid()
  ));

CREATE POLICY "Vendor owner views own progress"
  ON public.vendor_approval_progress FOR SELECT TO authenticated
  USING (EXISTS (
    SELECT 1 FROM public.vendors v WHERE v.id = vendor_id AND v.user_id = auth.uid()
  ));