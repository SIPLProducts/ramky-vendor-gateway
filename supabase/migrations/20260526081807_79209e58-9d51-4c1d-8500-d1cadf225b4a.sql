
-- Helper: does this user have access to a given screen via any active custom role?
CREATE OR REPLACE FUNCTION public.has_screen_permission(_user_id uuid, _screen_key text)
RETURNS boolean
LANGUAGE sql
STABLE SECURITY DEFINER
SET search_path = public
AS $$
  SELECT EXISTS (
    SELECT 1
    FROM public.user_custom_roles ucr
    JOIN public.custom_roles cr ON cr.id = ucr.custom_role_id AND cr.is_active = true
    JOIN public.custom_role_screen_permissions p
      ON p.custom_role_id = cr.id
     AND p.screen_key = _screen_key
     AND p.can_access = true
    WHERE ucr.user_id = _user_id
  );
$$;

-- Replace legacy RLS on buyer_scm_mappings with permission-driven policies
DROP POLICY IF EXISTS "Admins manage buyer-scm mappings" ON public.buyer_scm_mappings;
DROP POLICY IF EXISTS "Customer admins manage own tenant buyer-scm mappings" ON public.buyer_scm_mappings;
DROP POLICY IF EXISTS "Mapped users can read own mappings" ON public.buyer_scm_mappings;

CREATE POLICY "User mgmt can read buyer-scm mappings"
ON public.buyer_scm_mappings FOR SELECT TO authenticated
USING (
  has_role(auth.uid(),'sharvi_admin'::app_role)
  OR has_role(auth.uid(),'admin'::app_role)
  OR has_screen_permission(auth.uid(),'user-management')
  OR buyer_user_id = auth.uid()
  OR scm_manager_user_id = auth.uid()
);

CREATE POLICY "User mgmt can insert buyer-scm mappings"
ON public.buyer_scm_mappings FOR INSERT TO authenticated
WITH CHECK (
  has_role(auth.uid(),'sharvi_admin'::app_role)
  OR has_role(auth.uid(),'admin'::app_role)
  OR has_screen_permission(auth.uid(),'user-management')
);

CREATE POLICY "User mgmt can update buyer-scm mappings"
ON public.buyer_scm_mappings FOR UPDATE TO authenticated
USING (
  has_role(auth.uid(),'sharvi_admin'::app_role)
  OR has_role(auth.uid(),'admin'::app_role)
  OR has_screen_permission(auth.uid(),'user-management')
)
WITH CHECK (
  has_role(auth.uid(),'sharvi_admin'::app_role)
  OR has_role(auth.uid(),'admin'::app_role)
  OR has_screen_permission(auth.uid(),'user-management')
);

CREATE POLICY "User mgmt can delete buyer-scm mappings"
ON public.buyer_scm_mappings FOR DELETE TO authenticated
USING (
  has_role(auth.uid(),'sharvi_admin'::app_role)
  OR has_role(auth.uid(),'admin'::app_role)
  OR has_screen_permission(auth.uid(),'user-management')
);
