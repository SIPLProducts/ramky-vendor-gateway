## Fixes

### 1. Vendor Category shows in ALL CAPS
Root cause: rows in `sap_master_data` for `vendor_category` have `description = code` (e.g. `DISTRIBUTOR` / `DISTRIBUTOR`), so the Proper Case fallback never kicks in. Material Group has real proper descriptions and looks fine; Vendor Category doesn't.

Fix in code (data stays as-is):
- Add a `toProperCase` helper that title-cases any label that is entirely uppercase (letters + spaces/&/`-`).
- Apply it in two render spots:
  - `src/components/vendor/ClassificationField.tsx` → inside `toOptions`, on the `label` before returning.
  - `src/components/vendor/VendorReviewDialog.tsx` → in the SAP-code → description mapper used by the Classification Details block.
- Codes sent to the backend are unchanged; only the displayed label is normalized.

Result: `DISTRIBUTOR` → `Distributor`, `IMPORT` → `Import`, `MANUFACTURER` → `Manufacturer`, `TRADER` → `Trader`. Already-proper descriptions (e.g. `Admin Miscellaneous`) are left untouched.

### 2. Re-approve after rejection — comments mandatory + saved
In `src/components/approvals/StageApprovalView.tsx`, the buyer re-approval dialog currently uses `placeholder="Optional remarks"` and only blocks submit on classification, not on remarks.

Changes:
- Add a `Label` above the Textarea: `Remarks *` (with destructive asterisk).
- Change placeholder to `Enter remarks (required)`.
- Extend the submit-disabled condition so `rejectedRemarks.trim().length === 0` also disables the button for `action === 'approve'` (and for `send_to_vendor`, keep current behavior unless you want it required there too — proposing required for both to match "comments mandatory").
- Saving already works: `submitRejectedAction` posts `comments: rejectedRemarks.trim()` to `buyer-reapprove-rejected`, which (per the last change) writes the raw string into `vendor_approval_progress.comments`. No edge-function change needed.

### Files touched
- `src/components/vendor/ClassificationField.tsx`
- `src/components/vendor/VendorReviewDialog.tsx`
- `src/components/approvals/StageApprovalView.tsx`

No DB migration, no edge function redeploy.