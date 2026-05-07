## Why Finance 1 isn't seeing the vendor

The vendor `a0a0b224... (Pending SAP Sync)` was submitted on **2026-04-22**, when the approval matrix only had **SCM_MANAGER** and **SCM_HEAD** levels configured. The Finance 1, Finance 2 and CEO Office levels were added later (2026-05-07).

At submit time, `route-vendor-approval` snapshots the matrix and inserts one `vendor_approval_progress` row per active level. For this vendor it created only two rows:

```
level 1  SCM_MANAGER  approved  2026-05-07 09:58
level 2  SCM_HEAD     approved  2026-05-07 09:59
```

When SCM Head approved, `process-approval-action` saw zero remaining pending rows, so it correctly (per its rules) jumped the vendor to `pending_sap_sync`. Finance 1, Finance 2 and CEO Office were never inserted into its chain, so they will never see it.

New vendors submitted after the matrix change (e.g. `e159c529...`, `6d652397...`) already have all 5 stages in `vendor_approval_progress` and will flow correctly.

## Fix

### 1. Backfill the missing chain for vendor `a0a0b224...`

One-time migration that, for this vendor:
- Inserts `pending` progress rows for FINANCE_1 (level 3), FINANCE_2 (level 4), and CEO_OFFICE (level 5, since vendor `is_msme_registered = true`), pointing at the active matrix level ids for tenant `6fd07201-...`.
- Resets `vendors.status` from `pending_sap_sync` back to `finance_1_review` so it appears in the Finance 1 inbox.
- Adds an `audit_logs` entry noting the backfill.

### 2. Generalize: backfill any other vendor with the same gap

In the same migration, for every vendor whose current `vendor_approval_progress` is missing one or more active stages (excluding MSME-only stages when the vendor is non-MSME) and whose status is not `sap_synced` / rejected, insert the missing pending rows and set the vendor status back to the earliest still-pending stage.

Vendors that are already `sap_synced` (e.g. `67e5dc0a...`) are left untouched — they have already been pushed to SAP and re-opening them would be wrong.

### 3. Prevent recurrence

Update `supabase/functions/process-approval-action/index.ts` so that, before declaring "all approvals done → pending_sap_sync", it re-reads the current active matrix for the tenant and inserts any missing downstream stage rows (filtered by MSME) for this vendor. This way, if the matrix grows after a vendor is already in flight, the chain auto-extends instead of short-circuiting to SAP sync.

No UI changes are required — the existing Finance 1 / Finance 2 / CEO Office tabs will pick the vendor up automatically once the progress rows exist.

## Files touched

- New SQL migration (backfill + status reset for affected vendors)
- `supabase/functions/process-approval-action/index.ts` (auto-extend chain on approval)
