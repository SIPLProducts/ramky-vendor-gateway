CREATE POLICY "Authenticated can read active custom roles"
ON public.custom_roles
FOR SELECT
TO authenticated
USING (is_active = true);