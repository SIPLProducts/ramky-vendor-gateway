-- Helper: treat custom roles 'Admin','Sharvi Admin','Customer Admin' as admin-equivalent
CREATE OR REPLACE FUNCTION public.is_admin_like(_user_id uuid)
RETURNS boolean
LANGUAGE sql
STABLE SECURITY DEFINER
SET search_path = public
AS $$
  SELECT
    public.has_role(_user_id, 'sharvi_admin'::app_role)
    OR public.has_role(_user_id, 'admin'::app_role)
    OR public.has_role(_user_id, 'customer_admin'::app_role)
    OR EXISTS (
      SELECT 1
      FROM public.user_custom_roles ucr
      JOIN public.custom_roles cr ON cr.id = ucr.custom_role_id
      WHERE ucr.user_id = _user_id
        AND cr.is_active = true
        AND lower(cr.name) IN ('admin','sharvi admin','customer admin')
    );
$$;

-- user_roles: allow admin-like users to write (existing self-protection lives in client/UI)
DROP POLICY IF EXISTS "Admins can insert user roles" ON public.user_roles;
DROP POLICY IF EXISTS "Admins can update user roles" ON public.user_roles;
DROP POLICY IF EXISTS "Admins can delete user roles" ON public.user_roles;

CREATE POLICY "Admins can insert user roles" ON public.user_roles
  FOR INSERT TO authenticated
  WITH CHECK (public.is_admin_like(auth.uid()));

CREATE POLICY "Admins can update user roles" ON public.user_roles
  FOR UPDATE TO authenticated
  USING (public.is_admin_like(auth.uid()))
  WITH CHECK (public.is_admin_like(auth.uid()));

CREATE POLICY "Admins can delete user roles" ON public.user_roles
  FOR DELETE TO authenticated
  USING (public.is_admin_like(auth.uid()));

-- user_tenants: add admin-like manage policy (keep existing sharvi/customer_admin policies)
DROP POLICY IF EXISTS "Admin-like can manage user tenants" ON public.user_tenants;
CREATE POLICY "Admin-like can manage user tenants" ON public.user_tenants
  FOR ALL TO authenticated
  USING (public.is_admin_like(auth.uid()))
  WITH CHECK (public.is_admin_like(auth.uid()));

-- user_custom_roles: align with is_admin_like (keeps screen-permission path too)
DROP POLICY IF EXISTS "Admins manage user custom roles" ON public.user_custom_roles;
CREATE POLICY "Admins manage user custom roles" ON public.user_custom_roles
  FOR ALL TO authenticated
  USING (public.is_admin_like(auth.uid()) OR public.has_screen_permission(auth.uid(), 'user_management'))
  WITH CHECK (public.is_admin_like(auth.uid()) OR public.has_screen_permission(auth.uid(), 'user_management'));