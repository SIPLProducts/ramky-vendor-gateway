# Optional Vendor Comment On Submit

## What changes
1. **Submit popup (Review & Submit tab)**: Clicking **Submit** opens a small popup "Add Comments (Optional)" with a text box (max 1000 characters) and two buttons: **Cancel** and **Submit Application**. The vendor can leave it empty and still submit. Applies to new submissions and resubmissions after correction (domestic and international).
2. **Save**: The comment is stored with the application, and also recorded in the approval history as a "Vendor Submitted" entry with that comment, so every resubmission's comment is kept.
3. **Show to approvers**: In **View Details** (Buyer, SCM CO, SCM Head, Finance 1/2, CEO Office, SAP Team), a **Vendor Comments** block appears inside the Review Comments section, showing the comment and submission date (dd-mm-yyyy). The approval timeline also shows it as the vendor's step comment. Hidden when no comment was entered.

Existing submit flow, validations, emails, reference numbers and data stay unchanged.

## Technical details
- Migration: add nullable `vendors.vendor_submit_comments text` (additive, no data changes).
- `VendorRegistration.tsx`: wrap `handleSubmit` (and the bottom Submit button at ~line 2037) with a Dialog; pass the trimmed comment into `submitVendor`/`resubmitVendor`.
- `useVendorRegistration.tsx`: write `vendor_submit_comments` on submit/resubmit, then insert a `vendor_approval_history` row (stage `VENDOR`, action `submitted`, comments) non-blocking; add an insert policy for the vendor owner if missing.
- `VendorReviewDialog.tsx`: render Vendor Comments in the Review Comments card; timeline reads the history row.
- Self-hosted Quality/Production: apply the migration and rebuild the frontend.
