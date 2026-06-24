# SAP Sync Popup Fixes

Three small UI/data adjustments to the SAP Sync flow.

## 1. Make Vendor Class & MSME read-only in SAP Sync popup
File: `src/components/sap/SapFieldsDialog.tsx`

- Vendor Class (VEN_CLASS) field (line 150): replace the editable `TextField` with a `ReadOnlyField` showing `form.ven_class` (still auto-derived: empty when GST present, "0" otherwise; or tenant default).
- MSME (Minority Indicator) field (line 202-203): replace the editable `SelectField` with a `ReadOnlyField` showing the human label (e.g. "SMA — Small") resolved from `form.msme`. Value is still auto-derived from vendor's MSME category and sent in the payload.

## 2. Rename MSME "Small" code from SML → SMA
File: `src/components/sap/SapFieldsDialog.tsx`

- Line 203 options list: change `['SML', 'SML — Small']` → `['SMA', 'SMA — Small']`.
- Line 298 `buildDefaults`: change `cat === 'small' ? 'SML'` → `cat === 'small' ? 'SMA'`.

(No other occurrences of `'SML'` exist in src or supabase — verified.)

## 3. Remove Download button in Review dialog → Documents tab
Files:
- `src/components/vendor/VendorDocuments.tsx` — add optional prop `hideDownload?: boolean`; when true, do not render the Download `<Button>` (lines 257–263). Eye/preview button stays.
- `src/components/vendor/VendorReviewDialog.tsx` (line 684) — pass `hideDownload` to `<VendorDocuments vendorId={vendor.id} hideDownload />`.

Other usages (`VendorList`, `FinanceReview`, `PurchaseApproval`) keep the Download button (prop defaults to false).

## Out of scope
No payload/edge-function changes; the SAP payload already sends `form.msme` and `form.ven_class` regardless of whether the UI is editable.
