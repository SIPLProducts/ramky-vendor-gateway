
-- Custom Roles table
CREATE TABLE public.custom_roles (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  name text UNIQUE NOT NULL,
  description text,
  is_active boolean NOT NULL DEFAULT true,
  created_by uuid,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

ALTER TABLE public.custom_roles ENABLE ROW LEVEL SECURITY;

CREATE POLICY "All authenticated can read custom roles"
  ON public.custom_roles FOR SELECT TO authenticated USING (true);

CREATE POLICY "Admins manage custom roles"
  ON public.custom_roles FOR ALL TO authenticated
  USING (has_role(auth.uid(), 'sharvi_admin'::app_role) OR has_role(auth.uid(), 'admin'::app_role))
  WITH CHECK (has_role(auth.uid(), 'sharvi_admin'::app_role) OR has_role(auth.uid(), 'admin'::app_role));

CREATE TRIGGER update_custom_roles_updated_at
  BEFORE UPDATE ON public.custom_roles
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

-- Screen permissions per custom role
CREATE TABLE public.custom_role_screen_permissions (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  custom_role_id uuid NOT NULL REFERENCES public.custom_roles(id) ON DELETE CASCADE,
  screen_key text NOT NULL,
  can_access boolean NOT NULL DEFAULT false,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE(custom_role_id, screen_key)
);

ALTER TABLE public.custom_role_screen_permissions ENABLE ROW LEVEL SECURITY;

CREATE POLICY "All authenticated can read custom role permissions"
  ON public.custom_role_screen_permissions FOR SELECT TO authenticated USING (true);

CREATE POLICY "Admins manage custom role permissions"
  ON public.custom_role_screen_permissions FOR ALL TO authenticated
  USING (has_role(auth.uid(), 'sharvi_admin'::app_role) OR has_role(auth.uid(), 'admin'::app_role))
  WITH CHECK (has_role(auth.uid(), 'sharvi_admin'::app_role) OR has_role(auth.uid(), 'admin'::app_role));

CREATE TRIGGER update_custom_role_perms_updated_at
  BEFORE UPDATE ON public.custom_role_screen_permissions
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

-- User ↔ custom role assignments
CREATE TABLE public.user_custom_roles (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL,
  custom_role_id uuid NOT NULL REFERENCES public.custom_roles(id) ON DELETE CASCADE,
  assigned_by uuid,
  assigned_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE(user_id, custom_role_id)
);

ALTER TABLE public.user_custom_roles ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can view own custom role assignments"
  ON public.user_custom_roles FOR SELECT TO authenticated
  USING (user_id = auth.uid() OR has_role(auth.uid(), 'sharvi_admin'::app_role) OR has_role(auth.uid(), 'admin'::app_role));

CREATE POLICY "Admins manage user custom roles"
  ON public.user_custom_roles FOR ALL TO authenticated
  USING (has_role(auth.uid(), 'sharvi_admin'::app_role) OR has_role(auth.uid(), 'admin'::app_role))
  WITH CHECK (has_role(auth.uid(), 'sharvi_admin'::app_role) OR has_role(auth.uid(), 'admin'::app_role));

CREATE INDEX idx_user_custom_roles_user ON public.user_custom_roles(user_id);
CREATE INDEX idx_custom_role_perms_role ON public.custom_role_screen_permissions(custom_role_id);
