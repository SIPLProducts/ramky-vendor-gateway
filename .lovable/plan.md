## Goal

Everywhere a vendor is listed in a table, show the SAP **NAME1** value instead of `legal_name`:

- GSTIN present → **Trade Name** (fallback Legal Name)
- GSTIN absent → **Legal Name / PAN Account Holder Name** (fallback Trade Name)

The shared helper `getSapName1(vendor)` in `src/lib/sapPayloadBuilder.ts` already encodes this rule and is used in SAP Sync. We'll reuse it everywhere.

## Changes

### Frontend tables — swap displayed name to `getSapName1(vendor) || vendor.legal_name`

Update only the vendor-name cell/label in each table/list (no other columns, no business logic):

1. `src/pages/VendorList.tsx` — list card name (line ~411).
2. `src/pages/Dashboard.tsx` — recent vendors table (line ~310). Also include `trade_name, gstin` in the `.select(...)` (line ~117).
3. `src/pages/FinanceReview.tsx` — list row name (line ~260).
4. `src/pages/PurchaseApproval.tsx` — list row name (line ~312).
5. `src/pages/GstCompliance.tsx` — table cell (line ~524). Already selects what's needed.
6. `src/pages/DocumentVerification.tsx` — sidebar vendor list item (line ~705) only.
7. `src/components/sap/MultipleSapSyncDialog.tsx` — list item (line ~139).
8. `src/components/approvals/StageApprovalView.tsx` — uses `item.vendorName` from the edge function; no change here (handled below).

Search filters and dialog titles are out of scope to keep this strictly a table-display change.

### Approval list edge function — compute NAME1 server-side

`supabase/functions/list-pending-approvals-by-stage/index.ts`:

- Add `gstin` to the two `vendors` `.select(...)` calls.
- Replace both `vendorName: v?.legal_name ?? v?.trade_name ?? …` expressions with the NAME1 rule:
  ```ts
  vendorName: (v?.gstin ? (v?.trade_name || v?.legal_name) : (v?.legal_name || v?.trade_name)) || p.vendor_id.slice(0, 8)
  ```
- Redeploy the function.

This fixes the SCM Manager Approval table (the screenshot) plus every other stage table that consumes `StageApprovalView`.

### Out of scope

- `legal_name` usages in dialog titles, audit logs, exports, search filters, SAP payload internals, KYC pages, and the registration form — all preserved as-is.
- No DB or schema changes; no new columns.
- No changes to `getSapName1` itself.

## Files touched

- `src/pages/VendorList.tsx`
- `src/pages/Dashboard.tsx`
- `src/pages/FinanceReview.tsx`
- `src/pages/PurchaseApproval.tsx`
- `src/pages/GstCompliance.tsx`
- `src/pages/DocumentVerification.tsx`
- `src/components/sap/MultipleSapSyncDialog.tsx`
- `supabase/functions/list-pending-approvals-by-stage/index.ts` (+ redeploy)
