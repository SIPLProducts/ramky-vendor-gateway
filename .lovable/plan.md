## Add "GST Compliance Report" tab to View Details dialog

Add a 4th tab next to **Validations** inside `VendorReviewDialog` (used by SAP Sync and every Approval stage screen) showing the same GST Compliance Report layout currently rendered in `GstCompliance.tsx`, plus the vendor's GST compliance document.

### Changes

**1. `src/components/vendor/VendorReviewDialog.tsx`**
- Update tabs from `grid-cols-3` → `grid-cols-4` and add a 4th trigger:
  `<TabsTrigger value="gst_compliance"><Shield/> GST Compliance Report</TabsTrigger>`.
- On dialog open, fetch the latest `vendor_validations` row where `vendor_id = vendor.id` and `validation_type = 'gst'`, plus list documents from the `vendor-documents` bucket filtered to GST / compliance files (re-use the same helper `VendorDocuments` uses).
- Derive the report fields from `validation.details` when present, otherwise fall back to deterministic values from `vendor.gstin` (score 85 / Active / Low / Regular / current month), mirroring the logic in `GstCompliance.tsx` lines 164–214.
- Render a new `<TabsContent value="gst_compliance">` inside a `ScrollArea` containing:
  - Header row of 3 cards: **Compliance Score** (color-coded), **GST Status**, **Risk Level**.
  - 2-column grid: **GSTIN**, **Registration Date**, **Filing Status**, **Last Filed Return**.
  - **Recent Returns Filed** table (Period / Return Type / Filed On / Status badge).
  - **Compliance Document** section: list the vendor's GST certificate / compliance file with View + Download buttons (signed URL from `vendor-documents` bucket). Empty state: "No compliance document uploaded".
- Use semantic tokens (`text-primary`, `bg-muted`, etc.) — no raw colors.

**2. No other files**
- `StageApprovalView.tsx` already opens `VendorReviewDialog` for every approval stage (SCM Manager, SCM Head, Finance 1, Finance 2, CEO), so the tab appears in all approval screens automatically.
- `SAPSync.tsx` also uses the same dialog → tab shows there too.
- No DB / edge function / business-logic changes.

### Out of scope
- Re-running live GST compliance API calls from inside the dialog (the tab is read-only and reuses the most recent stored validation).
- Changes to `GstCompliance.tsx` page itself.
- Document upload flow.