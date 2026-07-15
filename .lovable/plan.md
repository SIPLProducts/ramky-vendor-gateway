# Vendor-Specific Application Progress Diagram + SAP Status Detail

## Problem

The **Application Progress** tracker currently renders a fixed set of 8 steps for every vendor, regardless of the vendor's actual approval matrix, and the SAP Sync step doesn't reflect the real sync sub-status.

Observed in the screenshots:
1. Vendors whose matrix includes **CEO Office** don't see it in the diagram (screenshot 2).
2. Vendors whose matrix does **not** include SCM Head / Finance 2 still see them greyed out.
3. SCM CO stage should always render as **"SCM CO"** in the diagram (no `SCM CO2` level suffix).
4. SAP step must show the actual sync sub-status (SAP Sync Pending / DMS Pending / SAP Synced) plus the SAP vendor code when available.

## Solution (frontend only)

Rewrite `src/components/vendor/RegistrationStatusTracker.tsx` so the middle approver steps are **derived from `approvalProgress`** and the SAP step description reflects the vendor's live sync state.

```text
Submitted → Document Verification → [dynamic stages from matrix] → SAP Sync
```

### Stage derivation

- Sort `approvalProgress` by `level_number` and map each row to a stage step:
  - `BUYER` → "Buyer Approval"
  - `SCM_MANAGER` → **"SCM CO"** (always; collapse multiple SCM_MANAGER rows into one step whose status aggregates: completed only when all approved, active when the first pending row in the whole chain is here, failed when any rejected)
  - `SCM_HEAD` → "SCM Head Approval"
  - `FINANCE_1` → "Finance 1 Approval"
  - `FINANCE_2` → "Finance 2 Approval"
  - `CEO_OFFICE` → "CEO Office Approval"
- Stages not present in `approvalProgress` do not appear.
- Recompute the connector line fill from the new dynamic step count.
- Fallback: if `approvalProgress` is empty, keep the current fixed 8-step layout so nothing regresses.

### Per-step status

- `completed` — all rows for that stage are `approved`
- `failed` — any row `rejected`
- `active` — contains the first pending row across the whole chain
- `pending` — otherwise

Document Verification stays `completed` once any approval row exists (unchanged).

### SAP Sync step

Extend the tracker props with an optional `sapSyncStatus` (already available on the vendor row / status enum) and render the description accordingly:

| Condition | Label |
|---|---|
| `sap_vendor_code` present OR status `sap_synced` / `approved` | **"SAP Synced · <sap_vendor_code>"** (step = completed) |
| Status `pending_sap_sync` and no SAP code yet | **"SAP Sync Pending"** (step = active) |
| DMS document sync still in progress (SAP code present but DMS not yet complete — detected via `sap_dms_status` field on the vendor when available) | **"DMS Pending"** (step = active) |
| All approvals done, awaiting SAP push | **"SAP Sync Pending"** (step = active) |
| Nothing yet | **"Awaiting SAP sync"** (step = pending) |
| `sap_team_rejected` / `sap_team_closed` | **"Action required"** (step = failed) |

`VendorStatus.tsx` (the caller) will be updated to pass through `sapVendorCode` and, if present on the vendor row, the DMS status field. No new columns are added.

## Files to change

- `src/components/vendor/RegistrationStatusTracker.tsx` — dynamic step construction, new SAP description logic, new optional prop for DMS status.
- `src/pages/VendorStatus.tsx` — pass `sapVendorCode` and the DMS status field to the tracker (already passes `approvalProgress`; verify and extend).

No backend, schema, workflow, RLS, or approval-logic changes. `ApprovalTimeline` (the lower list) stays as-is and continues to show `SCM CO1`, `SCM CO2` per level.

## Verification

- Vendor with matrix Buyer + SCM CO + Finance 1 + CEO Office + SAP → diagram shows exactly those 6 steps between Submitted and SAP Sync; CEO Office visible; no SCM Head / Finance 2.
- Vendor with two SCM CO approvers → single "SCM CO" step, completed only after both approve.
- SAP-synced vendor → SAP step ticked with "SAP Synced · <code>".
- Approved but not yet pushed → "SAP Sync Pending".
- SAP code created, DMS still syncing → "DMS Pending".
