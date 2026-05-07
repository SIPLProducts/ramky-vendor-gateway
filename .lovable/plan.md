## Goal

Make the approval flow match the spec exactly:

```text
Vendor Submission
   ↓
L2 → L3 → ... → Ln  (dynamic SCM Managers, in level order)
   ↓
L1 → SCM Head
   ↓
Finance 1
   ↓
Finance 2
   ↓
MSME?  ── YES → CEO Office → SAP Sync
       └─ NO  ───────────────→ SAP Sync
```

The matrix data model and most of the routing already supports this. The remaining gaps are:

1. CEO Office (Level 5, `requires_msme = true`) is not seeded for either tenant, so MSME vendors skip CEO and go straight to SAP Sync.
2. There is no CEO Office approver configured.
3. Need to verify the runtime ordering for SCM Managers at L2..Ln (already correct in `route-vendor-approval`).

## Changes

### 1. Add CEO Office level for both tenants (data insert, not schema)

For each of:
- Ramky Energy & Environment (`6fd07201-…`)
- Ramky Pharma City (`77062586-…`)

Insert one row into `approval_matrix_levels`:
- `level_number = 5`
- `stage = 'CEO_OFFICE'`
- `level_name = 'Level 5 · CEO Office'`
- `approval_mode = 'ANY'`
- `requires_msme = true`  ← MSME-only gate (already honored by `route-vendor-approval`)
- `is_active = true`

### 2. Seed CEO Office approver

Default to `ceo@ramky.com` as the L5 `approver_email` for both tenants (admin can change later in the Approval Matrix screen at `/admin/users` → Approval Matrix tab — the UI already supports the CEO_OFFICE stage and shows an MSME-only badge).

### 3. Re-route in-flight vendors so the new L5 row appears for MSME vendors

Call `route-vendor-approval` for each pending MSME vendor in those tenants so a fresh `vendor_approval_progress` chain is generated that includes Level 5. Non-MSME vendors will not get a CEO row (filter already in place).

### 4. Verify and document

- Confirm `process-approval-action` already advances Finance 2 → CEO Office (MSME) or Finance 2 → SAP Sync (non-MSME). It does: it advances to the next pending row by `level_number`, and if none remain it sets `pending_sap_sync`. Since route-vendor-approval only inserts CEO when `is_msme_registered = true`, non-MSME vendors automatically skip it.
- Confirm `RegistrationStatusTracker` already shows the 7-step flow including a CEO step.

### 5. Surface "previous approver not approved yet" message

Already implemented earlier (`blockedByPrevious` flag in `list-pending-approvals-by-stage` + disabled buttons in `StageApprovalView`). No change needed — included here for traceability.

## Technical details

| Item | File / Action |
|---|---|
| Insert L5 rows + approvers | New migration (DDL-safe inserts using `INSERT … SELECT` keyed on tenant code) |
| Re-route in-flight MSME vendors | One-time SQL: for each `vendor_id` where `is_msme_registered = true` AND status is in any `*_review`/`pending_sap_sync` state in those tenants, delete + reinsert progress rows mirroring the new ordered active levels |
| Edge functions | No changes — `route-vendor-approval` and `process-approval-action` already handle the CEO_OFFICE stage and MSME gating |
| Frontend | No changes — `RegistrationStatusTracker`, `VendorList` badges, and `CeoApproval` page are already wired |

## Verification

1. Open Admin → Approval Matrix for both tenants → see Level 5 · CEO Office row with `ceo@ramky.com`, MSME-only badge.
2. Submit a new MSME vendor → progresses L2 → L1 → Finance 1 → Finance 2 → CEO Office → SAP Sync.
3. Submit a new non-MSME vendor → progresses L2 → L1 → Finance 1 → Finance 2 → SAP Sync (skips CEO).
4. Existing MSME vendor mid-flow → after Finance 2 approval, lands at CEO Office page.
5. SCM Head still sees "previous approver has not approved yet" until SCM Manager approves.
