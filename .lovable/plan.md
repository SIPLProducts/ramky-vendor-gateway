## Goal

Add a **Reject** action on the SAP Sync screen with mandatory remarks, persist a new `sap_team_rejected` status, and surface a new **Rejected** tab listing rejected vendors with their reason.

## Scope

- Only the SAP Sync screen (`src/pages/SAPSync.tsx`). All Vendors, approvals, and other lists are unchanged.

## UI changes (`src/pages/SAPSync.tsx`)

1. Add a red **Reject** button next to **Prepare & Sync** on each vendor row in the SAP Sync tab.
2. Clicking it opens a small confirmation dialog with:
   - Vendor name (read-only)
   - **Reject Remarks** textarea — **mandatory** (submit disabled until non-empty)
   - Cancel / Confirm Reject buttons
3. On confirm: call a new edge function `sap-team-reject-vendor` with `{ vendorId, remarks }`. On success: toast, refresh list.
4. Extend the tab bar from 2 tabs to **3 tabs**: `SAP Sync`, `DMS Sync`, `Rejected`.
5. **Rejected tab** lists vendors whose `status = 'sap_team_rejected'` (scoped through the same `useTenantFilter` rules already in place). Each row shows:
   - Company name, reference number, ID
   - A red "SAP Team Rejected" badge
   - The rejection remarks (from `last_rejection_comments`) and rejected-by / rejected-at metadata
   - A **View** button (reuse existing detail dialog). No Prepare & Sync / Reject actions here.
6. The "Ready for SAP Sync" KPI count excludes rejected vendors (already does, since they won't be in finance-approved status). Add a small "Rejected" KPI or just rely on the tab.

## Backend changes

1. **Migration**:
   - `ALTER TYPE public.vendor_status ADD VALUE IF NOT EXISTS 'sap_team_rejected';`
   - No new columns — reuse `last_rejected_by`, `last_rejected_at`, `last_rejection_comments`, `last_rejection_stage='SAP_TEAM'`.
2. **New edge function** `supabase/functions/sap-team-reject-vendor/index.ts`:
   - Auth via `requireAuthenticatedUser` with allow-list `['admin','sharvi_admin','SAP Team']`.
   - Validates `remarks` is non-empty.
   - Updates `vendors`: `status='sap_team_rejected'`, `last_rejected_by=auth.userId`, `last_rejected_at=now()`, `last_rejection_comments=remarks`, `last_rejection_stage='SAP_TEAM'`.
   - Inserts `audit_logs` row: action `sap_team_reject`, details `{ remarks }`.
   - Register in `supabase/config.toml` with `verify_jwt = true`.
3. **`useVendors` / list query** already returns all statuses, so the Rejected tab can filter client-side. No hook changes needed.

## Verification

- Reject a vendor → confirm it disappears from SAP Sync tab, appears under Rejected with the remarks shown and a red badge.
- Try empty remarks → submit disabled.
- Non-SAP Team user → reject button still shown? It is, but the edge function will 403. (SAP Sync screen is already gated by SAP Team role, so this is fine.)
- Verify status enum value is added via `supabase--linter`.

## Out of scope

- No "Un-reject" / restore flow.
- No new email notifications.
- No changes to All Vendors, Dashboard, or approvals screens.
