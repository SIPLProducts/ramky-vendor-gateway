-- Create table for email tracking events
CREATE TABLE public.invitation_email_events (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  invitation_id UUID REFERENCES public.vendor_invitations(id) ON DELETE CASCADE,
  email_id TEXT,
  event_type TEXT NOT NULL, -- 'sent', 'delivered', 'opened', 'clicked', 'bounced', 'complained'
  event_data JSONB,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

-- Enable RLS
ALTER TABLE public.invitation_email_events ENABLE ROW LEVEL SECURITY;

-- Admin can view all events
CREATE POLICY "Admins can view email events"
  ON public.invitation_email_events
  FOR SELECT
  USING (
    EXISTS (
      SELECT 1 FROM public.user_roles
      WHERE user_id = auth.uid()
      AND role IN ('admin', 'sharvi_admin', 'customer_admin')
    )
  );

-- Add columns to track email status on invitations
ALTER TABLE public.vendor_invitations
ADD COLUMN IF NOT EXISTS email_sent_at TIMESTAMP WITH TIME ZONE,
ADD COLUMN IF NOT EXISTS email_opened_at TIMESTAMP WITH TIME ZONE,
ADD COLUMN IF NOT EXISTS email_clicked_at TIMESTAMP WITH TIME ZONE,
ADD COLUMN IF NOT EXISTS resend_email_id TEXT;

-- Create index for faster lookups
CREATE INDEX idx_invitation_email_events_invitation_id ON public.invitation_email_events(invitation_id);
CREATE INDEX idx_invitation_email_events_email_id ON public.invitation_email_events(email_id);