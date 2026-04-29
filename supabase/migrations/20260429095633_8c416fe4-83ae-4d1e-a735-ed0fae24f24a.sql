-- Email configuration table
CREATE TABLE public.smtp_email_configs (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_email text NOT NULL UNIQUE,
  smtp_host text NOT NULL,
  smtp_port integer NOT NULL DEFAULT 587,
  encryption text NOT NULL DEFAULT 'tls' CHECK (encryption IN ('none','ssl','tls','starttls')),
  smtp_username text NOT NULL,
  app_password text NOT NULL,
  from_name text,
  is_active boolean NOT NULL DEFAULT true,
  created_by uuid,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

ALTER TABLE public.smtp_email_configs ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Admins manage smtp_email_configs"
ON public.smtp_email_configs
FOR ALL
TO authenticated
USING (
  has_role(auth.uid(), 'sharvi_admin'::app_role)
  OR has_role(auth.uid(), 'admin'::app_role)
  OR has_role(auth.uid(), 'customer_admin'::app_role)
)
WITH CHECK (
  has_role(auth.uid(), 'sharvi_admin'::app_role)
  OR has_role(auth.uid(), 'admin'::app_role)
  OR has_role(auth.uid(), 'customer_admin'::app_role)
);

CREATE TRIGGER update_smtp_email_configs_updated_at
BEFORE UPDATE ON public.smtp_email_configs
FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

-- SECURITY DEFINER RPC that returns all columns except app_password
CREATE OR REPLACE FUNCTION public.list_smtp_configs()
RETURNS TABLE (
  id uuid,
  user_email text,
  smtp_host text,
  smtp_port integer,
  encryption text,
  smtp_username text,
  from_name text,
  is_active boolean,
  has_password boolean,
  created_by uuid,
  created_at timestamptz,
  updated_at timestamptz
)
LANGUAGE sql
STABLE SECURITY DEFINER
SET search_path = public
AS $$
  SELECT
    s.id, s.user_email, s.smtp_host, s.smtp_port, s.encryption,
    s.smtp_username, s.from_name, s.is_active,
    (s.app_password IS NOT NULL AND length(s.app_password) > 0) AS has_password,
    s.created_by, s.created_at, s.updated_at
  FROM public.smtp_email_configs s
  WHERE
    has_role(auth.uid(), 'sharvi_admin'::app_role)
    OR has_role(auth.uid(), 'admin'::app_role)
    OR has_role(auth.uid(), 'customer_admin'::app_role)
  ORDER BY s.updated_at DESC;
$$;

-- Grant access to the new screen for admin roles
INSERT INTO public.role_screen_permissions (role, screen_key, can_access)
VALUES
  ('sharvi_admin'::app_role, 'email_configuration', true),
  ('admin'::app_role, 'email_configuration', true),
  ('customer_admin'::app_role, 'email_configuration', true)
ON CONFLICT DO NOTHING;