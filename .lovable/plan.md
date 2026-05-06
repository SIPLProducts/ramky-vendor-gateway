# Approval Flow — 5 Separate Screens (Option B, corrected hierarchy)

## Pipeline (matches the diagram)

```text
Buyer (initiates vendor)
  → SCM Manager (L2 ... Ln)        — multiple managers, buyer routed to one of them
      → SCM Head (L1)              — single, final SCM approver
          → Finance 1
              → Finance 2          — validates MSME + GST, optional declaration upload
                  → if vendor.is_msme_registered = true  → CEO Office → SAP Sync
                    if vendor.is_msme_registered = false → SAP Sync
```

Key correction: **L1 = SCM Head (top), L2..Ln = SCM Managers (below)**. SCM Managers act first; SCM Head approves last in the SCM block before Finance.

## 1. Database (migration)

Add to `approval_matrix_levels`:
- `stage` text — one of `SCM_MANAGER | SCM_HEAD | FINANCE_1 | FINANCE_2 | CEO_OFFICE`
- `requires_msme` boolean default false (only CEO Office)

Backfill: existing levels mapped by `level_number` (lowest = `SCM_HEAD` if only 1 SCM level exists, otherwise highest number = SCM_HEAD, others = SCM_MANAGER). Admin can re-tag in the matrix screen.

Seed screen-permission keys: `scm_manager_approval`, `scm_head_approval`, `finance1_approval`, `finance2_approval`, `ceo_approval`.

## 2. Approval Matrix admin UI (`ApprovalMatrixConfig.tsx`)

- Each level row gets a **Stage** dropdown.
- Multiple `SCM_MANAGER` rows allowed (one per L2..Ln).
- Exactly one `SCM_HEAD`, one `FINANCE_1`, one `FINANCE_2`, optionally one `CEO_OFFICE`.
- Selecting `CEO_OFFICE` auto-sets `requires_msme = true` with a hint: "Only runs when vendor is MSME registered".

## 3. Routing engine (`route-vendor-approval/index.ts`)

When a vendor is submitted:
1. Read `vendors.is_msme_registered` and the buyer's selected SCM Manager (existing assignment field, or default to all SCM Managers if none selected).
2. Build the ordered stage list:
   `SCM_MANAGER (selected one)` → `SCM_HEAD` → `FINANCE_1` → `FINANCE_2` → `CEO_OFFICE (only if MSME)`
3. Drop CEO Office when vendor is non-MSME.
4. Insert `vendor_approval_progress` rows numbered 1..N so the existing "active = lowest pending" logic continues to work.

`process-approval-action/index.ts`:
- After the last pending level approves, set `vendors.status = 'pending_sap_sync'` so the SAP Sync screen picks it up.

## 4. Five separate screens

Each is its own route, its own sidebar item, gated by its own screen permission.

| Screen | Route | Filter | Actions |
|---|---|---|---|
| **SCM Manager Approval** | `/approvals/scm-manager` | active level where `stage = SCM_MANAGER` and current user is approver | Approve / Reject + Comments |
| **SCM Head Approval** | `/approvals/scm-head` | active level where `stage = SCM_HEAD` | Approve / Reject + Comments |
| **Finance 1** | `/approvals/finance-1` | `stage = FINANCE_1` | View vendor + Approve / Reject |
| **Finance 2** | `/approvals/finance-2` | `stage = FINANCE_2` | Vendor view + MSME Status panel + GST Compliance panel + optional declaration upload + Approve / Reject |
| **CEO Office Approval** | `/approvals/ceo` | `stage = CEO_OFFICE` (only MSME vendors arrive) | Final summary + Approve / Reject |

Implementation:
- Shared hook `usePendingApprovalsByStage(stage)` — wraps current `useMyApprovals` logic, adds a stage filter via join on `approval_matrix_levels.stage`.
- Shared `<ApprovalListView>` — table + drawer with vendor details and the approve/reject form.
- Each page is a thin wrapper passing its `stage` (Finance 2 also injects the MSME/GST sub-panels).
- Sidebar adds 5 menu items under an "Approvals" group, each visible only when the user has the matching screen permission.
- `RolePermissions.tsx` automatically picks up the 5 new screen keys for the matrix.

## 5. SAP Sync — unchanged
Already lists vendors with `pending_sap_sync` and supports manual + bulk sync with the missing-fields popup.

## Verification
1. Configure matrix: 3 SCM Managers (L2..L4), 1 SCM Head (L1), Finance 1, Finance 2, CEO Office.
2. Buyer submits vendor → routed to chosen SCM Manager only → after approval moves to SCM Head → Finance 1 → Finance 2.
3. MSME = Yes vendor: appears in CEO Office screen after Finance 2, then SAP Sync.
4. MSME = No vendor: skips CEO, lands directly in SAP Sync.
5. Each role sees only its own screen and its own pending vendors.
