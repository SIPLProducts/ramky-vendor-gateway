
-- 1) tenants: restrict to authenticated only
DROP POLICY IF EXISTS "Authenticated users can view active tenants" ON public.tenants;
CREATE POLICY "Authenticated users can view active tenants"
  ON public.tenants
  FOR SELECT
  TO authenticated
  USING (is_active = true);

-- Also lock the manage policy to authenticated role
DROP POLICY IF EXISTS "Sharvi admins can manage all tenants" ON public.tenants;
CREATE POLICY "Sharvi admins can manage all tenants"
  ON public.tenants
  FOR ALL
  TO authenticated
  USING (has_role(auth.uid(), 'sharvi_admin'::app_role))
  WITH CHECK (has_role(auth.uid(), 'sharvi_admin'::app_role));

-- 2) custom_roles: scope reads by tenant membership
DROP POLICY IF EXISTS "Authenticated read custom roles" ON public.custom_roles;
CREATE POLICY "Users read own tenant custom roles"
  ON public.custom_roles
  FOR SELECT
  TO authenticated
  USING (
    has_role(auth.uid(), 'sharvi_admin'::app_role)
    OR has_role(auth.uid(), 'admin'::app_role)
    OR (tenant_id IS NOT NULL AND user_belongs_to_tenant(auth.uid(), tenant_id))
  );

-- 3) smtp_email_configs: customer_admin restricted to own configs
DROP POLICY IF EXISTS "Admins manage smtp_email_configs" ON public.smtp_email_configs;
CREATE POLICY "Platform admins manage all smtp configs"
  ON public.smtp_email_configs
  FOR ALL
  TO authenticated
  USING (
    has_role(auth.uid(), 'sharvi_admin'::app_role)
    OR has_role(auth.uid(), 'admin'::app_role)
  )
  WITH CHECK (
    has_role(auth.uid(), 'sharvi_admin'::app_role)
    OR has_role(auth.uid(), 'admin'::app_role)
  );

CREATE POLICY "Customer admins manage their own smtp configs"
  ON public.smtp_email_configs
  FOR ALL
  TO authenticated
  USING (
    has_role(auth.uid(), 'customer_admin'::app_role)
    AND created_by = auth.uid()
  )
  WITH CHECK (
    has_role(auth.uid(), 'customer_admin'::app_role)
    AND created_by = auth.uid()
  );

-- Update list_smtp_configs to honour the same scoping
CREATE OR REPLACE FUNCTION public.list_smtp_configs()
 RETURNS TABLE(id uuid, user_email text, smtp_host text, smtp_port integer, encryption text, smtp_username text, from_name text, reply_to text, is_active boolean, has_password boolean, created_by uuid, created_at timestamp with time zone, updated_at timestamp with time zone)
 LANGUAGE sql
 STABLE SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
  SELECT
    s.id, s.user_email, s.smtp_host, s.smtp_port, s.encryption,
    s.smtp_username, s.from_name, s.reply_to, s.is_active,
    (s.app_password IS NOT NULL AND length(s.app_password) > 0) AS has_password,
    s.created_by, s.created_at, s.updated_at
  FROM public.smtp_email_configs s
  WHERE
    has_role(auth.uid(), 'sharvi_admin'::app_role)
    OR has_role(auth.uid(), 'admin'::app_role)
    OR (has_role(auth.uid(), 'customer_admin'::app_role) AND s.created_by = auth.uid())
  ORDER BY s.updated_at DESC;
$function$;

-- 4) realtime.messages: require authenticated session for subscriptions.
-- Table-level RLS on the published tables (vendors, vendor_validations) still
-- governs which row events the user actually receives.
ALTER TABLE IF EXISTS realtime.messages ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Authenticated can use realtime" ON realtime.messages;
CREATE POLICY "Authenticated can use realtime"
  ON realtime.messages
  FOR SELECT
  TO authenticated
  USING (auth.uid() IS NOT NULL);
