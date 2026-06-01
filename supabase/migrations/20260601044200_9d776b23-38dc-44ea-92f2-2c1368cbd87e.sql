ALTER PUBLICATION supabase_realtime ADD TABLE public.vendor_approval_progress;
ALTER TABLE public.vendor_approval_progress REPLICA IDENTITY FULL;