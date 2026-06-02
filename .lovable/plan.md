# Create Vendor → Direct Form Navigation (No Dialog)

## Goal
Clicking **Create Vendor** on Vendor Invitations must land the buyer directly on the Vendor Registration Form. No dialog, no popup, no pre-collection of vendor name / email / phone / company.

## Changes

### 1. `src/pages/VendorRegistration.tsx`
- **Remove** the on-behalf bootstrap dialog UI and all related state (`needsOnBehalfBootstrap`, `obEmail`, `obVendorName`, `obPhone`, `obTenantId`, `obEmailError`, `obSubmitting`) and the `Dialog/Input/Label/Select` imports added for it.
- **Replace** the bootstrap with an automatic invitation row creation on mount:
  - When URL has `?onBehalf=1` and no `?onBehalfOf=<id>`, immediately call a new helper `bootstrapOnBehalfInvitation()` inside a `useEffect` (runs once after auth + tenant context are ready).
  - Helper inserts a `vendor_invitations` row with:
    - `created_on_behalf: true`
    - `created_by: user.id`
    - `tenant_id: currentTenantId` (from `useTenantContext`; if user has multiple and none selected, fall back to first tenant from `useTenants`)
    - `email`: placeholder `onbehalf+<shortUuid>@placeholder.local` (will be overwritten when vendor enters real email in Step 1 — see step 2)
    - `vendor_name`: `"Draft Vendor"` placeholder
    - `phone_number`: `null` (or empty string if NOT NULL)
    - `token`: generated UUID
    - `expires_at`: now + 60 days
    - `status`: same default the existing `createVendorOnBehalf` mutation uses
  - On success: set `onBehalfInvitationId`, replace URL with `navigate('/vendor/registration?onBehalfOf=<id>', { replace: true })`, then let the existing on-behalf flow take over.
  - On failure: toast error and `navigate('/admin/invitations')`.
- Show the existing loading guard (`isLoadingVendor || isValidatingToken`) while bootstrap is in flight (add the new flag to the same guard).

### 2. `src/hooks/useVendorRegistration.tsx`
- When the buyer fills Step 1 / Company Details in on-behalf mode, on auto-save / next-step, **sync** the real values back to the `vendor_invitations` row tied to `onBehalfInvitationId`:
  - `vendor_name ← legal_name` (or trade_name fallback)
  - `email ← primary_email`
  - `phone_number ← primary_phone`
- This keeps the invitation list (Vendor Invitations screen) showing correct vendor info instead of the placeholders, and keeps downstream notifications correct (`notify-vendor-submission` already reads invite first, vendor row second).
- Single `update` against `vendor_invitations` keyed by `onBehalfInvitationId`, fired on the same save that already persists Step 1.

### 3. `src/pages/AdminInvitations.tsx`
- No change to the existing button click (already navigates to `/vendor/registration?onBehalf=1` from the previous turn).
- Leave the legacy `isCreateVendorOpen` dialog, its state, and the `createVendorOnBehalf` mutation **in place but unused** — safer than ripping them out and risking regressions in resume/other flows. (Optional cleanup later.)

## Preserved (untouched)
- Standard "New Invitation" email-send flow.
- Per-row **Resume** action on existing on-behalf rows.
- All validations, approval workflow, buyer-stage auto-approval, SAP/DMS sync, role permissions, other screens.
- `notify-vendor-submission` edge function (no change needed — placeholder gets overwritten before submit).

## Out of scope
- No DB migration.
- No edge function changes.
- No UI changes to Vendor Invitations list rendering.

## Edge cases handled
- Buyer abandons form before Step 1 save → an invitation row with placeholder email exists but is harmless (still resumable from the list; can be cancelled like any other on-behalf draft).
- Buyer reloads the page → URL already has `?onBehalfOf=<id>`, so the bootstrap effect skips and existing resume path runs.
- Buyer has no tenant context → bootstrap fails fast with toast and returns to invitations list.
