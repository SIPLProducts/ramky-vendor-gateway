CREATE POLICY "Admins can insert user roles" ON public.user_roles
  FOR INSERT TO authenticated
  WITH CHECK (public.has_role(auth.uid(), 'sharvi_admin'::app_role) OR public.has_role(auth.uid(), 'admin'::app_role));

CREATE POLICY "Admins can update user roles" ON public.user_roles
  FOR UPDATE TO authenticated
  USING (public.has_role(auth.uid(), 'sharvi_admin'::app_role) OR public.has_role(auth.uid(), 'admin'::app_role));

CREATE POLICY "Admins can delete user roles" ON public.user_roles
  FOR DELETE TO authenticated
  USING (public.has_role(auth.uid(), 'sharvi_admin'::app_role) OR public.has_role(auth.uid(), 'admin'::app_role));