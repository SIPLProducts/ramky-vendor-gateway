## Goal
Add a second rejection action on the SAP Sync screen — **Reject & Send to Buyer** — that bounces the vendor application back to the inviting Buyer (not to "Duplicate Rejected Data"), notifies the Buyer by email, and lets the Buyer edit and resubmit. On resubmission, the vendor re-enters the standard multi-level approval workflow from the start.

## UI changes — `src/pages/SAPSync.tsx`

1. Beside the existing **Duplicate Reject** button on each SAP-tab vendor card, render a new **Reject & Send to Buyer** button (outline / amber styling to distinguish from Duplicate Reject).
2. Add new state:
   - `returnVendor: VendorRow | null`
   - `returnRemarks: string`
   - `returningVendorId: string | null`
3. Add a new dialog "Reject & Send to Buyer" with:
   - Vendor name (read-only)
   - Mandatory **Remarks** textarea (validated non-empty; show inline error + toast on submit if empty)
   - Cancel / Confirm buttons
4. `handleConfirmReturnToBuyer` invokes the new edge function `sap-team-return-to-buyer` with `{ vendorId, remarks }`. On success: toast "Sent back to Buyer", close dialog, `refreshAllLists()`.

No changes to the Duplicate Reject flow, the Duplicate Rejected Data tab, or the PAN-duplicate auto-reject logic.

## Backend — new edge function `supabase/functions/sap-team-return-to-buyer/index.ts`

- Auth: require `admin`, `sharvi_admin`, or `SAP Team` (mirrors `sap-team-reject-vendor`).
- Input validation: `vendorId` (uuid string) and `remarks` (non-empty string) — 400 on missing.
- Service-role client.
- Load vendor + latest `vendor_invitations` row to identify the inviting Buyer (`created_by`, plus buyer email via `profiles`).
- Update `vendors`:
  - `status = 'buyer_review'` (vendor re-enters the Buyer stage; on the buyer's next save/resubmit the existing `trg_vendors_seed_approval` trigger re-seeds `vendor_approval_progress` for the full SCM Manager → SCM Head → Finance 1 → Finance 2 → CEO chain, restarting the workflow).
  - `last_rejection_comments = remarks`
  - `last_rejection_stage = 'SAP_TEAM'`
  - `last_rejected_by = auth.userId`, `last_rejected_at = now()`
- Clear stale `vendor_approval_progress` rows and call the `seed_vendor_approval_progress` RPC so the buyer sees a fresh pending Buyer row.
- Insert `audit_logs` row: `action = 'sap_team_return_to_buyer'`, details `{ remarks }`.
- Send email to the Buyer via the existing `send-status-notification` edge function (best-effort try/catch): subject context "Vendor returned by SAP team — please review and resubmit", recipient = buyer's email, comments = remarks.
- Return `{ success: true }`.

### Buyer-side resubmit (no new UI work needed)
The existing Buyer queue already lists vendors in `buyer_review`. When the Buyer opens, edits, and resubmits, the vendor advances through the standard approval chain (SCM Manager → SCM Head → Finance 1 → Finance 2 → CEO Office if MSME → SAP Sync), restarting the full workflow as requested.

## Out of scope
- No schema migration (reuses existing `last_rejection_*` columns and the `buyer_review` status).
- No changes to the Buyer dashboard UI — it already supports `buyer_review` + resubmission.
- No changes to the Duplicate Reject flow.

## Files touched
- `src/pages/SAPSync.tsx` — new button, dialog, handler, state.
- `supabase/functions/sap-team-return-to-buyer/index.ts` — new edge function (deployed via `supabase--deploy_edge_functions`).
