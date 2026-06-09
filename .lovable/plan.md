## Goal

Replace the UUID-slice "ID" displayed across the portal and the value sent to SAP with the daily reference number `YYYYMMDD###` (e.g. `20260609001`) that the DB trigger `assign_vendor_reference_number` already populates on `vendors.reference_number`.

## Changes

### 1. Approval screens (`SCM Manager Approval`, all other stages)

- `supabase/functions/list-pending-approvals-by-stage/index.ts`
  - Add `reference_number` to both `vendors` `.select()` calls (BUYER branch line 67 / 83, downstream branch line 189).
  - Add `referenceNumber` to each returned item (pending + rejected, both branches).
- `src/hooks/usePendingApprovalsByStage.tsx`
  - Add `referenceNumber?: string | null` to `StageApprovalItem`.
- `src/components/approvals/StageApprovalView.tsx`
  - In the two table rows (lines ~212 and ~315) render `Ref No: {it.referenceNumber}` instead of `ID: {it.vendorId}` (fallback to vendor id slice only if missing).

### 2. All Vendors list

- `src/hooks/useVendors.tsx` — `vendors` already uses `select('*')`, so `reference_number` is available.
- `src/pages/VendorList.tsx`
  - Line 404: replace `{vendor.id.slice(0, 8)}...` with `Ref No: {vendor.reference_number || vendor.id.slice(0,8)}`.
  - CSV export (line 208): change `ID: v.id` to `Reference: v.reference_number`.

### 3. SAP sync — send `reference_number` instead of UUID slice

In SAP payload, the reference is carried via `idnum` (idtype `SOLMN1`) and stored back on the vendor as `sap_reference_no`.

- `supabase/functions/sync-vendor-to-sap/index.ts`
  - Replace the four occurrences of `String(vendor.id || "").slice(0, 8).toUpperCase()` (lines 160, 359, 461, 578) with `String(vendor.reference_number || vendor.id || "").toUpperCase()` (keep UUID-slice fallback only for legacy rows without a reference_number).
  - This updates: the `vendor.reference_no` template token, both `row.idnum` assignments (template + client-supplied), and the `sap_reference_no` we persist after a successful sync.
- `supabase/functions/sync-vendors-to-sap-bulk/index.ts`
  - Same substitution at lines 69 and 197, using the loaded `vendor.reference_number`.

### 4. No DB / no migration

The trigger and `vendor_reference_counters` are already in place and the column is already populated on new submissions. No schema changes needed.

## Out of scope

- The existing vendor in the screenshot (`5e8222aa-…`) was created before the trigger was active, so it has no `reference_number`. New vendors created after the fix will display the correct `Ref No`. We can backfill that one row separately if desired.
- `SubmissionSuccessDialog` already shows the correct reference (fix applied last turn).

## Verification

1. Create a new vendor invitation → submit the registration form.
2. Confirm the success popup shows `# 20260609###`.
3. Open SCM Manager Approval and All Vendors → row shows `Ref No: 20260609###`.
4. Run SAP sync → payload `idnum` and stored `sap_reference_no` equal `20260609###`.
