## Goal
Make the new `sap_team_closed` status (introduced for "Duplicate & Close") render with a proper label and color everywhere status is shown — not just on the SAP Sync screen.

Today, screens like Dashboard, All Vendors list, Vendor Status, and the stage cell only know about `sap_team_rejected`. Any vendor moved to `sap_team_closed` falls through to a raw `sap_team_closed` string with the default badge.

## Files to update (label-only, no business logic)

1. **`src/pages/VendorList.tsx`** (`getStatusBadge` map)
   - Add: `sap_team_closed: { label: 'Duplicate & Closed', variant: 'destructive' }`

2. **`src/pages/Dashboard.tsx`**
   - Add `sap_team_closed` entry to `STATUS_LABELS` with label `Duplicate & Closed`, destructive variant.
   - Include `sap_team_closed` in the `rejected` counter alongside `sap_team_rejected` (so the Rejected KPI tile reflects closed-duplicates too).

3. **`src/pages/VendorStatus.tsx`**
   - Add `sap_team_closed: { label: 'Duplicate & Closed', variant: 'destructive' }` to the status label map.

4. **`src/components/admin/VendorStageCell.tsx`**
   - Add a `case 'sap_team_closed'` in `statusToStep` returning `{ step: -1, label: 'Duplicate & Closed', tone: 'destructive' }`.
   - Update the `stage:rejected` filter option to also include `sap_team_closed`, and rename it to `Stage: Duplicate & Closed` (covers both legacy `sap_team_rejected` and new `sap_team_closed`).

5. **`src/components/vendor/EmailNotificationDemo.tsx`** (demo dropdown)
   - Add a `sap_team_closed` option labelled `Duplicate & Closed` (red tone) so the demo list stays in sync.

6. **`src/components/vendor/RegistrationStatusTracker.tsx` / `src/types/vendor.ts` / `src/components/vendor/SuccessScreen.tsx`**
   - Only touch if the vendor-facing tracker should also recognise the closed state. Plan: add `'sap_team_closed'` to the `VendorStatus` union in `src/types/vendor.ts` and treat it like `sap_team_rejected` in `RegistrationStatusTracker` (terminal/destructive node). SuccessScreen needs no change (it only checks `sap_synced`).

## Out of scope
- No DB / enum / edge-function changes (already shipped in the previous task).
- No change to the SAP Sync screen — it already labels this correctly.
- No change to "Reject & Send to Buyer" flow or any other status.

## Verification
- Dashboard "Rejected" tile and status badges show "Duplicate & Closed" for the affected vendors.
- All Vendors list and Vendor Status page render the same label in destructive style.
- Stage filter "Duplicate & Closed" returns both `sap_team_closed` and legacy `sap_team_rejected` rows.