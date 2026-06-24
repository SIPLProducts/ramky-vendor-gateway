## Fix: `vendor_reference_number` column does not exist

**Root cause:** `supabase/functions/sap-team-return-to-buyer/index.ts` queries non-existent columns. Actual columns on `vendors` are `reference_number` and `sap_vendor_code`.

### Change
In `supabase/functions/sap-team-return-to-buyer/index.ts`:
- Line 62 SELECT list: replace `vendor_reference_number, vendor_code` with `reference_number, sap_vendor_code`.
- Line 93 (and any other reads): replace `vendor.vendor_reference_number` with `vendor.reference_number`, and `vendor.vendor_code` with `vendor.sap_vendor_code`.

### Hardening to prevent recurrence
Audit the same edge function once more after the edit for any other column names not present in the `vendors` schema (grep against the actual column list) so a third deploy isn't needed. The remaining flow (status → `returned_to_buyer`, clear `vendor_approval_progress`, find buyer via `vendor_invitations.created_by`, send SMTP email through `send-smtp-email`) is already correctly wired — only the column names are wrong.

After redeploy, "Reject & Send to Buyer" will succeed, the vendor is routed back to the originating buyer, and the rejection email is delivered.