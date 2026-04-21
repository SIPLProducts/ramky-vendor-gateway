DROP POLICY IF EXISTS "Admins can manage config" ON public.portal_config;

CREATE POLICY "Admins can manage config"
ON public.portal_config
FOR ALL
USING (
  has_role(auth.uid(), 'admin'::app_role)
  OR has_role(auth.uid(), 'sharvi_admin'::app_role)
  OR has_role(auth.uid(), 'customer_admin'::app_role)
)
WITH CHECK (
  has_role(auth.uid(), 'admin'::app_role)
  OR has_role(auth.uid(), 'sharvi_admin'::app_role)
  OR has_role(auth.uid(), 'customer_admin'::app_role)
);