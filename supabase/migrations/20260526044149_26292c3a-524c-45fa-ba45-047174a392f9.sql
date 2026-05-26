
-- profiles
DROP POLICY IF EXISTS "Admins can view all profiles" ON public.profiles;
CREATE POLICY "Admins can view all profiles" ON public.profiles
  FOR SELECT USING (
    public.has_role(auth.uid(), 'sharvi_admin'::app_role)
    OR public.has_role(auth.uid(), 'admin'::app_role)
    OR id = auth.uid()
  );

-- user_roles
DROP POLICY IF EXISTS "Admins can view all user roles" ON public.user_roles;
CREATE POLICY "Admins can view all user roles" ON public.user_roles
  FOR SELECT USING (
    public.has_role(auth.uid(), 'sharvi_admin'::app_role)
    OR public.has_role(auth.uid(), 'admin'::app_role)
    OR user_id = auth.uid()
  );

-- user_tenants
DROP POLICY IF EXISTS "Admins can read all user tenants" ON public.user_tenants;
CREATE POLICY "Admins can read all user tenants" ON public.user_tenants
  FOR SELECT USING (
    public.has_role(auth.uid(), 'admin'::app_role)
    OR public.has_role(auth.uid(), 'sharvi_admin'::app_role)
    OR user_id = auth.uid()
  );

-- user_custom_roles
DROP POLICY IF EXISTS "Users can view own custom role assignments" ON public.user_custom_roles;
CREATE POLICY "Users can view own custom role assignments" ON public.user_custom_roles
  FOR SELECT USING (
    user_id = auth.uid()
    OR public.has_role(auth.uid(), 'sharvi_admin'::app_role)
    OR public.has_role(auth.uid(), 'admin'::app_role)
  );
