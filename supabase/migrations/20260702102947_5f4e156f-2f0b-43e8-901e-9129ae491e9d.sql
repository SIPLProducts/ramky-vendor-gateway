ALTER POLICY "Admins can update any profile"
ON public.profiles
USING (public.is_admin_like(auth.uid()))
WITH CHECK (public.is_admin_like(auth.uid()));