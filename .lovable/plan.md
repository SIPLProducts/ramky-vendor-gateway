# Add Approval Stage Tracking to Vendor Invitations

## Problem
The Vendor Invitations page (where "Create Vendor" lives) only shows invitation-level info (Pending / Used / Expired). Once the vendor exists, users can't tell which approval stage it's at (Buyer → SCM Manager → SCM Head → Finance 1 → Finance 2 → CEO Office → SAP Sync → SAP Synced / Rejected).

## Solution
Enrich each invitation row with its linked vendor's reference number, current status, and a visual progress indicator showing the approval pipeline.

## Changes (frontend only)

### 1. Extend invitations query in `src/pages/AdminInvitations.tsx`
Join the linked vendor so each row carries:
- `vendor.reference_number`
- `vendor.status`
- `vendor.id` (for deep-link)

Use the existing `vendor_id` FK on `vendor_invitations` → `vendors`:
```ts
.select('*, vendor:vendors(id, reference_number, status)')
```

### 2. New table columns
Add two columns between "Vendor Name" and "Created":
- **Reference #** — `vendor.reference_number` as a link to `/vendors/:id`. Shows "—" if vendor not created yet.
- **Approval Stage** — a `StageBadge` + compact stepper.

### 3. `StageBadge` + `StageProgress` component (new file `src/components/admin/VendorStageCell.tsx`)
Maps `vendor.status` → label and pipeline position:

```text
Buyer → SCM Manager → SCM Head → Finance 1 → Finance 2 → CEO Office → SAP Sync → Done
```

Status → stage map:
- `draft`, `submitted`, `validation_pending`, `buyer_review` → Buyer (step 1)
- `scm_manager_review` → SCM Manager (step 2)
- `scm_head_review` → SCM Head (step 3)
- `finance_1_review` → Finance 1 (step 4)
- `finance_2_review` → Finance 2 (step 5)
- `ceo_office_review` → CEO Office (step 6)
- `pending_sap_sync` → SAP Sync (step 7)
- `sap_synced` → Done (green check, all steps filled)
- `sap_team_rejected` → red "Rejected by SAP Team" badge
- `returned_to_vendor` → amber "Returned to Vendor" badge
- `returned_to_buyer` → amber "Returned to Buyer" badge
- no vendor row yet → grey "Not Started" badge

Render:
- A colored `Badge` with the current stage label
- A horizontal dot/segment stepper (7 dots) — completed = primary, current = primary ring + pulse, future = muted. Tooltip on each dot shows its stage name.

### 4. Existing "Status" (Pending/Used/Expired) badge
Keep it — it represents the invitation lifecycle, which is different from approval stage. Move it under the email or into a smaller secondary chip so the new Approval Stage column gets visual priority.

### 5. Status filter
Extend the filter dropdown with an "Approval Stage" group (Buyer / SCM Manager / SCM Head / Finance 1 / Finance 2 / CEO Office / Pending SAP Sync / SAP Synced / Rejected / Returned) in addition to the existing invitation filters.

## Out of scope
- No DB changes — `vendors.status` and `vendor_invitations.vendor_id` already exist.
- No RLS changes — current `user_can_see_vendor` policy already scopes visibility per role.
- No new edge functions.

## Files touched
- `src/pages/AdminInvitations.tsx` — extend query, add columns, wire filter
- `src/components/admin/VendorStageCell.tsx` — new component (badge + stepper + tooltip)
