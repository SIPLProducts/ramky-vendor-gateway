## Goal
Wherever a vendor's name appears in the UI (tables, cards, popups), render it in Proper Case even when the underlying data is stored in ALL CAPS. Database values remain unchanged.

## Approach

1. Add a shared helper `toProperCase(value)` in `src/lib/textCase.ts`:
   - If value is null/empty → return as-is.
   - If value is entirely uppercase (ignoring digits/punctuation) → convert to Title Case per word (e.g. `RSJ HOLDINGS` → `Rsj Holdings`, `M/S SHARDA INFRASOLUTIONS PRIVATE LTD` → `M/s Sharda Infrasolutions Private Ltd`).
   - If value already contains lowercase letters → return unchanged (respect intentional casing).
   - Preserve common short tokens that should stay uppercase (`LTD`, `PVT`, `LLP`, `PLC`, `LLC`, `INC`, `CO`, `JV`, `SMC`, `M/S`, `&`) via a small allowlist so `RSJ HOLDINGS` → `RSJ Holdings` and `RAMKY-SMC (JV)` → `Ramky-SMC (JV)`.

2. Apply the helper wherever the vendor's legal/trade/display name is rendered:
   - Dashboard vendor applications table — `src/pages/Dashboard.tsx` (Vendor Name column).
   - All Vendors list — `src/pages/VendorList.tsx` (Vendor Name column).
   - Approval queues (SCM Manager, SCM Head, Finance 1/2, CEO Office, Buyer, SAP Team) — the shared list in `src/components/approvals/StageApprovalView.tsx` and the SAP dashboard `src/pages/SAPSync.tsx` (Vendor Name + Ref block).
   - View Details popup — `src/components/vendor/VendorReviewDialog.tsx` for **Legal Name**, **Trade Name**, and **PAN Holder Name** display values.
   - Approval Comments dialog header (vendor name prop) — `src/components/sap/ApprovalCommentsDialog.tsx`.
   - Any other place that renders `vendor.legal_name` / `vendor.trade_name` / `vendor.pan_holder_name` for display (search via `rg` before editing to catch stragglers like invitation lists).

3. Do NOT change:
   - Data stored in the database.
   - Vendor registration form input fields (users still type freely).
   - Email/subject text sent via edge functions (out of scope for a UI change).
   - Excel export values (keep raw for downstream systems).

## Technical Notes
- Pure presentation change — no schema, RLS, or edge function edits.
- Helper is pure and covered by a light unit assumption; no new deps.
- PAN Holder Name from KYC APIs is typically ALL CAPS by design of the source, so it will now render as Proper Case in the popup.
