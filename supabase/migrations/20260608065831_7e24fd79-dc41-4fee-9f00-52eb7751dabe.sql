DROP POLICY IF EXISTS "Admins manage buyer approval flows" ON public.buyer_approval_flows;

CREATE POLICY "Admins manage buyer approval flows"
ON public.buyer_approval_flows
FOR ALL
USING (
  has_role(auth.uid(), 'admin'::app_role)
  OR has_role(auth.uid(), 'sharvi_admin'::app_role)
  OR has_role(auth.uid(), 'customer_admin'::app_role)
  OR has_custom_role(auth.uid(), 'sharvi_admin')
  OR has_custom_role(auth.uid(), 'customer_admin')
  OR has_custom_role(auth.uid(), 'Admin')
  OR has_screen_permission(auth.uid(), 'user_management')
)
WITH CHECK (
  has_role(auth.uid(), 'admin'::app_role)
  OR has_role(auth.uid(), 'sharvi_admin'::app_role)
  OR has_role(auth.uid(), 'customer_admin'::app_role)
  OR has_custom_role(auth.uid(), 'sharvi_admin')
  OR has_custom_role(auth.uid(), 'customer_admin')
  OR has_custom_role(auth.uid(), 'Admin')
  OR has_screen_permission(auth.uid(), 'user_management')
);