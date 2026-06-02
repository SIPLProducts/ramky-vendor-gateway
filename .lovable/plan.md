# Create Vendor → Direct Navigation

## Goal
On the Vendor Invitations screen, clicking **Create Vendor** should navigate straight to the Vendor Registration Form (on-behalf mode), without the intermediate "Create Vendor on Behalf of Vendor" dialog that asks for email / vendor name / phone / company up front.

## Change (single file)
`src/pages/AdminInvitations.tsx`

1. Change the **Create Vendor** button's `onClick` from `setIsCreateVendorOpen(true)` to `navigate('/vendor/registration?onBehalf=1')`.
2. Leave the existing `isCreateVendorOpen` dialog, `createVendorOnBehalf` mutation, and the per-row "Resume" action **untouched** so resuming existing on-behalf drafts still works exactly as before.

## Form behavior in on-behalf mode without an invitation id
`src/pages/VendorRegistration.tsx` + `src/hooks/useVendorRegistration.tsx`

- When the URL has `?onBehalf=1` (no `onBehalfOf=<id>` yet), render the form in on-behalf mode and let the buyer enter the vendor's email, name, phone, and buyer company **inside the form itself** (Step 1 / Company Details — using existing fields, no new UI).
- On first save/auto-save, create the `vendor_invitations` row (same insert as today's `createVendorOnBehalf`: `created_on_behalf: true`, `created_by: buyer`, 60-day expiry, generated token, no email sent) and then continue using that invitation id for the rest of the session (replace URL with `?onBehalfOf=<id>` via `navigate(..., { replace: true })` so refresh/resume works).
- If the buyer leaves before first save, no invitation row is created — matches "navigate straight to the form" intent.

## Preserved (no changes)
- Standard "New Invitation" flow (email send) — unchanged.
- Validations, approval workflow, buyer-stage auto-approval for on-behalf submissions — unchanged.
- `Resume` button on existing on-behalf invitation rows — unchanged.
- All other screens, role permissions, SAP sync — unchanged.

## Out of scope
- No DB migration.
- No changes to approval routing, edge functions, or other pages.
