## Reports — fix stage status & add full vendor details

### 1. Stage status logic (Reports page + exports)

Today every stage in `STAGE_ORDER` defaults to `not_required` (orange badge), so skipped levels look like an error and pending levels are hidden. Rework `loadVendorReport.ts`:

- For each vendor, derive which stages are actually in its approval matrix from `vendor_approval_progress` rows (every level the router created).
- For each of the 7 stages produce one of:
  - `approved` / `rejected` / `returned` — when a progress row was acted on
  - `pending` — row exists with `status='pending'` (or this is the current stage based on `vendors.status`)
  - `skipped` — no row for this stage in the matrix → render as plain `—` (neutral, muted), NOT orange `not_required`
- SAP_TEAM derived as today from `audit_logs` + `vendors.status` (`pending_sap_sync` → pending, `sap_synced` → approved, rejections → rejected, otherwise skipped).
- Compute `current_stage` from the first `pending` stage; if vendor is `sap_synced`/`dms_synced` show `Completed`.

Status badge mapping in `Reports.tsx`:
- `approved` → green/secondary
- `rejected` / `returned` → red/destructive
- `pending` → blue/outline ("Pending")
- `skipped` → no badge, just `—` muted text, approver/date also `—`

Apply the same labels in Excel + PDF exports (replace literal `not_required` with `Skipped` and use `—` for approver/date/remarks when skipped).

### 2. Single-vendor report — full vendor-filled details

Currently the Single Vendor card shows only 8 summary fields. Expand `SingleVendorView` to render every section the vendor filled, grouped into collapsible cards (read-only):

1. Basic Information — legal name, trade name, vendor type, category, PAN, GSTIN, CIN, MSME, incorporation date, website
2. Registered & Communication Address — line1/2, city, state, country, pincode (both addresses)
3. Contact Persons — primary, finance, technical (name / designation / email / phone)
4. Banking Details — bank name, branch, IFSC, account no, account type, beneficiary
5. Tax & Compliance — GST regn type, TDS section, lower deduction cert, tax residency, place of supply
6. International fields (only when `vendor_type='international'`) — IBAN, SWIFT, intermediary bank, correspondent bank, tax jurisdiction
7. KYC / Documents — list `vendor_documents` (doc_type, file name, uploaded_at, verification status) with download link
8. Validation results — pulled from `vendor_validations` (PAN, GST, bank penny-drop, MSME, name-match) with status + verified_at
9. Approval Flow — existing per-stage table (now with corrected pending/skipped logic)
10. Invitation & Submission — invited_by, invited_at, invitation_email, on_behalf, submitted_at, last_rejection_comments

Each field renders only when it has a value (skip empty rows) so domestic vendors don't show empty international blocks. Use the existing `Field`/`Info` pattern with a grid; add an `<h3>` section header per card.

Data load: extend `loadVendorReports` in single-vendor mode (when `referenceNumber` is set OR only one vendor returned) to also fetch:
- full `vendors` row (`select *` for the single vendor instead of the trimmed column list)
- `vendor_documents` where `vendor_id = …`
- `vendor_validations` where `vendor_id = …`

Return them on `VendorReportRow` as optional `details`, `documents`, `validations` (only populated for single-vendor mode to keep the all-vendors query light).

### 3. Exports — full details for single-vendor

- **Excel** (`exportExcel.ts`): when one row + `details` present, add extra sheets: `Vendor Details` (key/value), `Documents`, `Validations`. Approval Flow sheet uses new status labels.
- **PDF** (`exportPdf.ts`): for single-vendor add sections for Basic Info, Address, Bank, Tax, Documents, Validations before the Approval Flow table; use `autoTable` per section.

### 4. Approval Progress card on Vendor Status page

`ApprovalTimeline` already only renders progress rows that exist, so skipped stages naturally don't appear — no change needed there. Add a small legend at the top of the timeline ("Skipped stages are not shown — only stages in this vendor's approval matrix are listed.") so users understand why a level is missing.

### Files

Edit:
- `src/lib/reports/loadVendorReport.ts` — new status derivation, fetch full single-vendor details/documents/validations, add `skipped` status
- `src/pages/Reports.tsx` — new badge/label rules, expanded `SingleVendorView` with grouped detail cards
- `src/lib/reports/exportExcel.ts` — extra sheets for single-vendor + new labels
- `src/lib/reports/exportPdf.ts` — extra sections for single-vendor + new labels
- `src/components/vendor/ApprovalTimeline.tsx` — legend line about skipped stages

No DB schema, RLS, or approval-matrix logic changes. No edits to vendor registration, approval pages, or SAP sync.
