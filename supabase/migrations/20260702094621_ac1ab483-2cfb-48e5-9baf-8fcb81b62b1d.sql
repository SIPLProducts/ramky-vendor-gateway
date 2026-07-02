
-- 1. Add status + last_login_attempt_at to profiles
ALTER TABLE public.profiles
  ADD COLUMN IF NOT EXISTS status text NOT NULL DEFAULT 'active',
  ADD COLUMN IF NOT EXISTS last_login_attempt_at timestamptz;

ALTER TABLE public.profiles
  DROP CONSTRAINT IF EXISTS profiles_status_check;
ALTER TABLE public.profiles
  ADD CONSTRAINT profiles_status_check CHECK (status IN ('active','inactive'));

-- 2. login_attempts table
CREATE TABLE IF NOT EXISTS public.login_attempts (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid,
  email text NOT NULL,
  attempt_status text NOT NULL CHECK (attempt_status IN ('success','inactive_user','invalid_credentials')),
  attempted_at timestamptz NOT NULL DEFAULT now(),
  ip text,
  user_agent text
);

CREATE INDEX IF NOT EXISTS login_attempts_email_idx ON public.login_attempts (email);
CREATE INDEX IF NOT EXISTS login_attempts_attempted_at_idx ON public.login_attempts (attempted_at DESC);
CREATE INDEX IF NOT EXISTS login_attempts_status_idx ON public.login_attempts (attempt_status);

GRANT SELECT ON public.login_attempts TO authenticated;
GRANT ALL ON public.login_attempts TO service_role;

ALTER TABLE public.login_attempts ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Admins can view login attempts" ON public.login_attempts;
CREATE POLICY "Admins can view login attempts"
ON public.login_attempts
FOR SELECT
TO authenticated
USING (public.is_admin_like(auth.uid()));

-- 3. RPC to check user status (SECURITY DEFINER so it works pre-auth)
CREATE OR REPLACE FUNCTION public.check_user_active(_email text)
RETURNS TABLE(user_id uuid, status text)
LANGUAGE sql
STABLE SECURITY DEFINER
SET search_path = public
AS $$
  SELECT p.id, p.status
  FROM public.profiles p
  WHERE lower(p.email) = lower(_email)
  LIMIT 1;
$$;

GRANT EXECUTE ON FUNCTION public.check_user_active(text) TO anon, authenticated;
