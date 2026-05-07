## Root cause

After SCM Head approves, `process-approval-action` looks for the next pending row in `vendor_approval_progress`. The code is correct — but for tenant **Ramky Infrastructure Limited** the `approval_matrix_levels` table only has **two** active rows:

```text
L1 · SCM Head      (stage = SCM_HEAD)
L2 · SCM Manager   (stage = SCM_MANAGER)
```

There are no `FINANCE_1`, `FINANCE_2`, or `CEO_OFFICE` levels. So when SCM Head approves, "no remaining pending" → vendor jumps straight to `pending_sap_sync`. Same problem for tenant **Ramky Pharma City** (only SCM_HEAD configured).

The "Finance 1 Approval" page shows 0 pending because no progress row ever has stage = FINANCE_1.

## Fix

### 1. Seed Finance 1 / Finance 2 matrix levels for both tenants

For each tenant insert these `approval_matrix_levels` rows (`is_active = true`, `requires_msme = false`, `approval_mode = 'ANY'`):

```text
level_number  stage      level_name
3             FINANCE_1  Level 3 · Finance 1
4             FINANCE_2  Level 4 · Finance 2
```

(For Ramky Pharma City — which currently only has the SCM_HEAD row — also add an SCM_MANAGER level so the existing SCM flow still works; skip if user prefers to configure it manually.)

### 2. Seed approvers for the new levels

- Finance 1 → `prasad.kvvk@sharviinfotech.com` (existing approver "prasad F1")
- Finance 2 → `pradeep.p@sharviinfotech.com` (existing approver "pradeep F2")

Insert into `approval_matrix_approvers` keyed by the new `level_id`.

### 3. Re-route in-flight vendors

Vendors currently sitting at `scm_manager_review` / `scm_head_review` already have only 2 progress rows. After step 1 they need new rows for Finance 1/2.

Two affected vendors today (`e159c529…`, `6d652397…`). For each:
- Insert pending `vendor_approval_progress` rows for the new FINANCE_1 + FINANCE_2 levels (renumbered 3, 4).
- No status change yet — they remain at `scm_manager_review`.

Vendors already past SCM (status = `pending_sap_sync` / `sap_synced`) are left alone.

### 4. Verification

- Confirm `approval_matrix_levels` for tenant RIL now has 4 active rows ordered SCM_MANAGER → SCM_HEAD → FINANCE_1 → FINANCE_2.
- Open Finance 1 page logged in as `prasad.kvvk@sharviinfotech.com` — should still show 0 (because SCM Head hasn't approved yet); then approve through SCM Manager → SCM Head and confirm vendor appears for Finance 1, then Finance 2.
- Existing approval edge functions (`process-approval-action`, `route-vendor-approval`, `list-pending-approvals-by-stage`) need **no code change** — they already advance using the next pending row.

## No code edits required

The fix is purely data: add matrix levels, approvers, and progress rows. Will be executed via a migration (DDL-safe inserts) plus an INSERT for the in-flight vendor progress rows.
