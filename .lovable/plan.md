## Goal

Replace the legacy 5-step tracker (Submitted → Document Verification → Finance Review → Purchase Approval → SAP Sync) with the real workflow:

```text
Submitted → Document Verification → SCM Manager Approval → SCM Head Approval
         → Finance 1 Approval → Finance 2 Approval → SAP Sync
```

…and make the vendor's status badge change as the request advances through each stage (e.g. "SCM Head Review", "Finance 1 Review") instead of staying stuck on "Purchase Review".

## Changes

### 1. New vendor status values
Add canonical workflow statuses on `public.vendors.status`:
- `scm_manager_review`
- `scm_head_review`
- `finance_1_review`
- `finance_2_review`
- `ceo_office_review` (only for MSME vendors)
- `pending_sap_sync` (already exists in code)

Keep legacy values (`purchase_review`, `finance_review`, …) readable for old rows but stop writing them.

Backfill: any vendor currently in `purchase_review` / `finance_review` whose `vendor_approval_progress` has a pending row → set status to match that pending stage.

### 2. `process-approval-action` edge function
After approving/rejecting a row in `vendor_approval_progress`, look up the **next** pending row's `approval_matrix_levels.stage` and update `vendors.status` to the matching review value above. If none pending → `pending_sap_sync`. On reject → `<stage>_rejected` (e.g. `scm_head_rejected`).

### 3. `route-vendor-approval` edge function
After creating progress rows, set `vendors.status` to the first pending stage (typically `scm_manager_review`).

### 4. `useVendorRegistration.tsx`
On submission set initial status to `scm_manager_review` (replace the two `purchase_review` writes at lines 613 and 996/1000).

### 5. `RegistrationStatusTracker.tsx`
Replace the 5-step array with the 7-step flow above. Update `getActiveStepIndex` to map each new status to its step. Rejection at any stage marks that step `failed`.

### 6. `VendorList.tsx` status badge
Extend `VendorStatus` union and `getStatusBadge` config map with labels:
- SCM Manager Review, SCM Head Review, Finance 1 Review, Finance 2 Review, CEO Office Review
- …Approved / …Rejected variants
- Add the same options to the status filter `<Select>`.

### 7. Other consumers
Quick sweep of `useRealtimeUpdates`, `Dashboard`, `EnterpriseStepIndicator`, `SuccessScreen`, `EmailNotificationDemo` to surface the new labels (they currently key off the old statuses).

## Verification

1. Submit a fresh vendor → status badge shows **SCM Manager Review**, tracker highlights step 3.
2. SCM Manager approves → badge flips to **SCM Head Review**, tracker advances to step 4; SCM Head's Approve/Reject buttons enable.
3. Continue through Finance 1, Finance 2, (CEO Office if MSME) → badge updates each time.
4. Final approval → status `pending_sap_sync`, tracker on step 7; after SAP sync → `sap_synced`.
5. Reject at any stage → badge shows `<stage> Rejected`, tracker marks that step failed.

No UI rewrite of approval pages needed — they already read from `vendor_approval_progress` via the new edge function.