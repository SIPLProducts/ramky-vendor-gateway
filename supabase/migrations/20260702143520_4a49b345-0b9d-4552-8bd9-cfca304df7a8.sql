ALTER TABLE public.vendor_invitations
  ADD COLUMN IF NOT EXISTS signin_sent_count integer NOT NULL DEFAULT 0,
  ADD COLUMN IF NOT EXISTS last_signin_sent_at timestamptz;