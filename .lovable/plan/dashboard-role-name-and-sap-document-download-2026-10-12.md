# Dashboard role/name and SAP document download

## Changes
1. In Dashboard **Status**, replace the two-line name and badge with one compact, non-wrapping label: **SCM CO (Brijesh)**. Use the same role-first format for Buyer, SCM Head, Finance 1, Finance 2, CEO Office, and SAP Team. Preserve existing lookup results, all eligible SAP Team names, and missing-assignment messages; statuses without a responsible person keep their status label.
2. In **SAP Team → Duplicate & Closed → View Details → Documents**, show a Download icon beside the existing View icon for each uploaded document. Keep document access permissions unchanged and retain the existing download handling and error messages.
3. Leave download visibility in other review screens unchanged.

## Technical details
- Update only Dashboard presentation; do not change approval routing, name lookup, search, or Excel export.
- `VendorReviewDialog` currently passes `hideDownload` to `VendorDocuments`, which already supports a Download button. Add an optional download-visibility setting, defaulting to the existing hidden behavior, and enable it from SAP Sync only for the selected Duplicate & Closed vendor.
- Give the document icons clear View/Download accessible names and tooltips.

## Verification
- Check a populated Dashboard for role-first parenthesized names on one line, including multiple SAP Team names and missing assignments.
- Open a Duplicate & Closed vendor, go to Documents, preview a file, then download it and confirm the correct file is received.
- Confirm other review screens retain their existing controls and the app has no build errors. If the available account cannot access these screens, report that verification limitation without changing its permissions.