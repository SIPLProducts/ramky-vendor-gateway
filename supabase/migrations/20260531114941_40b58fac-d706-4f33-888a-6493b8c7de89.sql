
-- Add returned-to-buyer and returned-to-vendor enum values
ALTER TYPE vendor_status ADD VALUE IF NOT EXISTS 'returned_to_buyer';
ALTER TYPE vendor_status ADD VALUE IF NOT EXISTS 'returned_to_vendor';

-- Carry rejection metadata on the progress chain (so reopened previous level shows why)
ALTER TABLE public.vendor_approval_progress
  ADD COLUMN IF NOT EXISTS rejection_comments TEXT,
  ADD COLUMN IF NOT EXISTS rejection_from_stage TEXT,
  ADD COLUMN IF NOT EXISTS rejection_from_user UUID,
  ADD COLUMN IF NOT EXISTS rejection_at TIMESTAMPTZ;

-- Mirror latest rejection on vendor for buyer / vendor banners
ALTER TABLE public.vendors
  ADD COLUMN IF NOT EXISTS last_rejection_comments TEXT,
  ADD COLUMN IF NOT EXISTS last_rejection_stage TEXT,
  ADD COLUMN IF NOT EXISTS last_rejected_by UUID,
  ADD COLUMN IF NOT EXISTS last_rejected_at TIMESTAMPTZ;
