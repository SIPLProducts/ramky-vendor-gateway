ALTER TABLE public.smtp_email_configs
  ADD COLUMN IF NOT EXISTS reply_to text;

DROP FUNCTION IF EXISTS public.list_smtp_configs();

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
    OR has_role(auth.uid(), 'customer_admin'::app_role)
  ORDER BY s.updated_at DESC;
$function$;