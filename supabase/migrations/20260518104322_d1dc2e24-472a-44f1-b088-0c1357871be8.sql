
ALTER TYPE vendor_status ADD VALUE IF NOT EXISTS 'dms_sync_pending';
ALTER TYPE vendor_status ADD VALUE IF NOT EXISTS 'dms_synced';

ALTER TABLE public.vendors
  ADD COLUMN IF NOT EXISTS dms_synced_at timestamptz,
  ADD COLUMN IF NOT EXISTS sap_reference_no text;
