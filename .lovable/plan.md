# Vendor Status page — SAP sub-status + SCM CO label

Scope: `/vendor-status/:id` presentation only. No backend/schema/logic changes.

## 1. Approval Progress list: "SCM CO2" → "SCM CO"

File: `src/components/vendor/ApprovalTimeline.tsx`

- Replace the `formatStageLevel` import/call with `formatStageLevelHistory` (already exported from `src/lib/approvalLabels.ts`).
- Effect: every `SCM_MANAGER` row renders as plain `SCM CO` regardless of level number. All other stages (`Buyer`, `SCM Head`, `Finance 1`, `Finance 2`, `CEO Office`) render exactly as today.
- No other component using `formatStageLevel` is touched (dashboards, approval queues keep numbered labels).

## 2. Surface the current SAP sync sub-status

The full set of terminal / SAP-stage statuses already exist in `vendor_status`:
`pending_sap_sync`, `dms_sync_pending`, `sap_synced`, `dms_synced`, `sap_team_rejected`, `sap_team_closed`.

### 2a. Vendor Details card — new "SAP Sync Status" field

File: `src/pages/VendorStatus.tsx`

Add a new grid field (visible only once the vendor has reached the SAP stage — i.e. status is one of the six above OR `sap_vendor_code` is set). Renders as a labelled badge:

| Vendor state | Badge text | Variant |
|---|---|---|
| `sap_synced` or `dms_synced` | `SAP Synced · <sap_vendor_code>` | default (green/primary) |
| `dms_sync_pending` | `DMS Pending · <sap_vendor_code>` | outline |
| `pending_sap_sync` with code | `DMS Pending · <sap_vendor_code>` | outline |
| `pending_sap_sync` without code | `SAP Sync Pending` | outline |
| `sap_team_rejected` / `sap_team_closed` | `Duplicate & Closed` | destructive |

The top-level "Current Status" badge stays untouched; this is an additional SAP-specific line so users don't have to interpret the tracker.

### 2b. Application Progress diagram — align SAP step with the same sub-statuses

File: `src/components/vendor/RegistrationStatusTracker.tsx`

Extend the existing SAP-step description logic to recognise the two DMS values (currently only `pending_sap_sync` / `sap_synced` / rejected are handled):

- Add `'dms_sync_pending'` to the `RegistrationStatus` union.
- SAP-step description mapping:
  - `sap_synced` or `dms_synced` → `SAP Synced · <code>` (completed, green check)
  - `dms_sync_pending` → `DMS Pending · <code>` (active)
  - `pending_sap_sync` + `sap_vendor_code` → `DMS Pending · <code>` (active) [existing behaviour]
  - `pending_sap_sync` no code → `SAP Sync Pending` (active) [existing]
  - `sap_team_rejected` / `sap_team_closed` → `Action required` (failed) [existing]
- Also add `'dms_synced'` handling in `VendorStatus.tsx`'s `STATUS_LABELS` (label `Approved (DMS Synced)`, variant `default`) so the top badge doesn't fall back to raw enum text.

## Out of scope

- No backend, RLS, edge function, migration, workflow, or approval-logic changes.
- No changes to Dashboard, VendorList, Reports, SAPSync, or approval queue pages.
