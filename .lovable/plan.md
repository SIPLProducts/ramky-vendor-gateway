## Goal
After a vendor is successfully created in SAP (BP_LIFNR returned), send a confirmation email to the Buyer who invited/created the vendor.

## Where
`supabase/functions/sync-vendor-to-sap/index.ts` — inside the `if (successRow && sapVendorCode)` block (lines 577–593), right after the `vendors` update and before returning `ok(...)`.

## Logic
1. Look up the buyer for this vendor:
   - Query `vendor_invitations` filtered by `vendor_id = vendorId`, order by `created_at desc`, limit 1, select `created_by`.
   - If `created_by` present, fetch `profiles` (`email`, `full_name`) for that user id.
2. If a buyer email is found, invoke the existing `send-smtp-email` edge function (already used elsewhere) with:
   - `to`: buyer email
   - `subject`: `Vendor ${vendor.legal_name} successfully created in SAP (${sapVendorCode})`
   - `html`: short branded message including vendor legal/trade name, SAP Vendor Code (`BP_LIFNR`), SAP reference no, and synced timestamp.
3. Wrap the entire notification in `try/catch` and log only — never fail or alter the SAP sync response if email fails. Also skip silently if no buyer/email is found.
4. Best-effort `audit_logs` insert with action `sap_sync_buyer_notified` containing `{ vendor_id, buyer_user_id, buyer_email, sap_vendor_code }`.

## Out of scope
- No DB schema changes.
- No changes to the SAP payload, response handling, DMS flow, or UI.
- No changes to `send-smtp-email` itself — it already reads admin SMTP config from `portal_config`.

## Files changed
- `supabase/functions/sync-vendor-to-sap/index.ts` (single insertion ~15 lines).
