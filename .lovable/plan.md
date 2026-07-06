## Plan

**Goal:** Remove the `Vendor_CFSTMT` block from the vendor registration flow only. Keep it visible in all View/Preview surfaces used by approvers, All Vendors, Reports, and SAP Sync.

### Changes

1. **`src/components/vendor/steps/ReviewStep.tsx`** (Review & Submit step in registration)
   - In the "Classification Details" section, remove the right-hand `Vendor_CFSTMT` card (Vendor Cash Flow, Tier Category — currently hardcoded to `-`).
   - Collapse the grid to a single-column layout so the remaining `Vendor_Details` card (Material Group for Vendors, Vendor Category) renders full width.
   - Keep the section header "Classification Details" and its edit link unchanged.

### Left unchanged (CFSTMT stays visible)

- `src/components/vendor/VendorSubmissionPreviewDialog.tsx` — View popup used across app.
- `src/components/vendor/VendorReviewDialog.tsx` — Approval/review dialog.
- `src/pages/VendorList.tsx` — All Vendors view popup.
- Approval screens, Reports, SAP Sync — they use the shared dialogs above.
- `OrganizationStep.tsx` registration classification inputs (already only Material Group + Vendor Category, no CFSTMT fields to remove).

### Verification

- Open vendor registration → Review & Submit: confirm only `Vendor_Details` card appears under Classification Details, no `Vendor_CFSTMT`.
- Open All Vendors → View: confirm Classification Details still shows both `Vendor_Details` and `Vendor_CFSTMT`.
- Open an approval screen preview: confirm both cards present.
