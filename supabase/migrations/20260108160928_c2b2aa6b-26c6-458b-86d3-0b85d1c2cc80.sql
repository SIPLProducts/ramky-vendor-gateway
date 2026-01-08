-- Enable realtime for vendors table to support live updates
ALTER PUBLICATION supabase_realtime ADD TABLE public.vendors;

-- Enable realtime for vendor_validations table
ALTER PUBLICATION supabase_realtime ADD TABLE public.vendor_validations;