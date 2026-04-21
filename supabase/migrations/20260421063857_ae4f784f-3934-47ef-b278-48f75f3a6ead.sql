
CREATE TABLE public.role_screen_permissions (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  role app_role NOT NULL,
  screen_key text NOT NULL,
  can_access boolean NOT NULL DEFAULT false,
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now(),
  UNIQUE(role, screen_key)
);

ALTER TABLE public.role_screen_permissions ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Everyone can read role permissions"
  ON public.role_screen_permissions FOR SELECT TO authenticated USING (true);

CREATE POLICY "Admins manage role permissions"
  ON public.role_screen_permissions FOR ALL TO authenticated
  USING (has_role(auth.uid(), 'sharvi_admin') OR has_role(auth.uid(), 'admin'))
  WITH CHECK (has_role(auth.uid(), 'sharvi_admin') OR has_role(auth.uid(), 'admin'));

CREATE TRIGGER update_role_screen_permissions_updated_at
  BEFORE UPDATE ON public.role_screen_permissions
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

-- Seed defaults
INSERT INTO public.role_screen_permissions (role, screen_key, can_access) VALUES
  -- sharvi_admin: everything
  ('sharvi_admin','dashboard',true),
  ('sharvi_admin','vendors',true),
  ('sharvi_admin','finance_review',true),
  ('sharvi_admin','purchase_approval',true),
  ('sharvi_admin','sap_sync',true),
  ('sharvi_admin','gst_compliance',true),
  ('sharvi_admin','scheduled_checks',true),
  ('sharvi_admin','audit_logs',true),
  ('sharvi_admin','user_management',true),
  ('sharvi_admin','role_permissions',true),
  ('sharvi_admin','admin_configuration',true),
  ('sharvi_admin','sharvi_admin_console',true),
  ('sharvi_admin','vendor_invitations',true),
  ('sharvi_admin','support',true),
  -- admin: everything except sharvi console
  ('admin','dashboard',true),
  ('admin','vendors',true),
  ('admin','finance_review',true),
  ('admin','purchase_approval',true),
  ('admin','sap_sync',true),
  ('admin','gst_compliance',true),
  ('admin','scheduled_checks',true),
  ('admin','audit_logs',true),
  ('admin','user_management',true),
  ('admin','role_permissions',true),
  ('admin','admin_configuration',true),
  ('admin','vendor_invitations',true),
  ('admin','support',true),
  -- customer_admin
  ('customer_admin','dashboard',true),
  ('customer_admin','vendors',true),
  ('customer_admin','vendor_invitations',true),
  ('customer_admin','admin_configuration',true),
  ('customer_admin','support',true),
  -- finance
  ('finance','dashboard',true),
  ('finance','vendors',true),
  ('finance','finance_review',true),
  ('finance','gst_compliance',true),
  ('finance','scheduled_checks',true),
  ('finance','audit_logs',true),
  ('finance','support',true),
  -- purchase
  ('purchase','dashboard',true),
  ('purchase','vendors',true),
  ('purchase','purchase_approval',true),
  ('purchase','support',true),
  -- approver
  ('approver','dashboard',true),
  ('approver','vendors',true),
  ('approver','support',true),
  -- vendor
  ('vendor','vendor_registration',true),
  ('vendor','support',true)
ON CONFLICT (role, screen_key) DO NOTHING;
