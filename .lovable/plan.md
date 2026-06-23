## Goal

Make the NAME1 display rule (GST → Trade Name, No GST → PAN/Legal Name) consistent **everywhere a vendor identity is shown to a user** — not just the main listing tables that were updated last round.

The helper `getSapName1(vendor)` in `src/lib/sapPayloadBuilder.ts` already encodes the rule and is the single source of truth. This plan reuses it.

## What's already done (no change needed)

These vendor listing tables already render `getSapName1(vendor) || vendor.legal_name`:

- `VendorList.tsx`, `Dashboard.tsx`, `FinanceReview.tsx`, `PurchaseApproval.tsx`, `GstCompliance.tsx`, `DocumentVerification.tsx`, `SAPSync.tsx`, `MultipleSapSyncDialog.tsx`
- Approvals tables (BuyerApproval / CeoApproval / Finance1Approval / Finance2Approval / ScmHeadApproval / ScmManagerApproval) — driven by `StageApprovalView` + edge function `list-pending-approvals-by-stage`, both already updated.

## What this plan changes

Extend the NAME1 rule to all remaining places where a vendor's name is shown as a result of clicking a row in those tables, plus the few stragglers, so the displayed name is always consistent with the table cell:

### 1. Dialog titles / headers opened from a vendor row
Replace `selectedVendor.legal_name` / `vendor.legal_name` in titles and toasts with `getSapName1(...) || legal_name || 'Vendor'`.

- `src/pages/FinanceReview.tsx` — dialog title (line 324)
- `src/pages/PurchaseApproval.tsx` — dialog title (line 407), finance-comment dialog vendor label (line 329), return-target row label
- `src/pages/VendorList.tsx` — sheet header (line 529), summary "Legal Name" field stays (it's an explicit label), return-target label (line 797) → use NAME1
- `src/pages/SAPSync.tsx` — reject confirmation dialog name (line 599), success/info toasts that include `vendor.legal_name` (lines 112, 174, 191 — `BPNAME` payload stays untouched per existing SAP rules)
- `src/components/vendor/VendorReviewDialog.tsx` — dialog title (line 417). Keep the labeled "Legal Name" and "Trade Name" rows in the body as-is.

### 2. Vendor's own status page
- `src/pages/VendorStatus.tsx` — add `gstin` to the `.select()`, change the "Company Name" field (line 108) to `getSapName1(vendor) || vendor.legal_name || vendor.trade_name || '—'`.

### 3. Audit logs row label
- `src/pages/AuditLogs.tsx` (line 169-170) — when rendering `Vendor: <name>` from `log.details`, prefer `details.trade_name` when `details.gstin` is present, else `details.legal_name`.

### 4. Realtime toast notifications
- `src/hooks/useRealtimeUpdates.tsx` — `vendorName` derivations (lines 61, 81) already use `trade_name || legal_name`. Tighten to the NAME1 rule using the row's `gstin` so they match the tables.

## Out of scope (unchanged)

- Explicit labeled fields like "Legal Name" / "Trade Name" inside detail panels.
- Registration form inputs, KYC tabs, OCR/API verification screens.
- SAP payload builders, `getSapName1` itself, `BPNAME` error-payload field.
- Exports (CSV "Company Name"/"Name" columns), search filters (they still match against `legal_name` and `trade_name` for usability).
- DB schema; no new columns.

## Technical notes

- Each touched file gets a `getSapName1` import from `@/lib/sapPayloadBuilder` if not already present.
- For `VendorStatus.tsx` and `AuditLogs.tsx`, ensure the selected fields include `gstin` / `trade_name` so the rule can be evaluated client-side.
- No edge function redeploys are required (the approvals function was already updated last round).
