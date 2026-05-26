
-- ============ smtp_email_configs: open to any authenticated user ============
DROP POLICY IF EXISTS "Customer admins manage their own smtp configs" ON public.smtp_email_configs;
DROP POLICY IF EXISTS "Platform admins manage all smtp configs" ON public.smtp_email_configs;
DROP POLICY IF EXISTS "Authenticated manage all smtp configs" ON public.smtp_email_configs;

CREATE POLICY "Authenticated manage all smtp configs"
  ON public.smtp_email_configs
  FOR ALL
  TO authenticated
  USING (true)
  WITH CHECK (true);

-- list_smtp_configs: drop role gate so any authenticated user gets all rows
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
  WHERE auth.uid() IS NOT NULL
  ORDER BY s.updated_at DESC;
$function$;

-- ============ User Management tabs: any authenticated user can READ ============
-- profiles
DROP POLICY IF EXISTS "Authenticated can view all profiles" ON public.profiles;
CREATE POLICY "Authenticated can view all profiles"
  ON public.profiles FOR SELECT
  TO authenticated
  USING (true);

-- user_roles
DROP POLICY IF EXISTS "Authenticated can view all user roles" ON public.user_roles;
CREATE POLICY "Authenticated can view all user roles"
  ON public.user_roles FOR SELECT
  TO authenticated
  USING (true);

-- user_tenants
DROP POLICY IF EXISTS "Authenticated can view all user tenants" ON public.user_tenants;
CREATE POLICY "Authenticated can view all user tenants"
  ON public.user_tenants FOR SELECT
  TO authenticated
  USING (true);

-- user_custom_roles
DROP POLICY IF EXISTS "Authenticated can view all user custom roles" ON public.user_custom_roles;
CREATE POLICY "Authenticated can view all user custom roles"
  ON public.user_custom_roles FOR SELECT
  TO authenticated
  USING (true);
