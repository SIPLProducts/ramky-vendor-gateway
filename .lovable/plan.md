# Show the GST Filing Status card in Approvals → View

## Problem

In the Vendor Registration → GST tab, when **GST = Yes**, the vendor sees a "GST Filing Status (Last 3 Months)" card with a 4-column table (Financial Year / Tax Period / Date of filing / Status) rendered by the shared `GstFilingStatusTable` component (see screenshot).

In **Approvals → View** (the `VendorReviewDialog` used by every stage view), the "GST Compliance Report" tab today renders its own ad-hoc "Recent Returns Filed" table, which does not visually match the registration card and — per the user report — is not appearing reliably for GST-registered vendors.

We want the **exact same card and table from registration** to appear in the Approvals → View dialog, populated from the GST verification response.

## Fix

Edit `src/components/vendor/VendorReviewDialog.tsx` only.

1. Import the reusable component already used by registration:
   ```ts
   import { GstFilingStatusTable } from '@/components/vendor/kyc/GstFilingStatusTable';
   ```
   (`normalizeFilingStatus` / `FilingStatusRow` are already imported.)

2. In the `gst_compliance` `TabsContent` (currently lines ~608–746), replace the existing "Recent Returns Filed" block (the `<div>` containing the inline `<Table>` of filing rows, lines ~666–705) with a card that mirrors the registration UI:

   ```tsx
   {(vendor?.gstin || filingRows.length > 0) && (
     <div className="rounded-lg border bg-card p-4 space-y-3">
       <div className="flex items-center gap-2">
         <Shield className="h-4 w-4 text-primary" />
         <h4 className="font-semibold text-sm">GST Filing Status (Last 3 Months)</h4>
       </div>
       {filingRows.length > 0 ? (
         <GstFilingStatusTable rows={filingRows} limit={3} />
       ) : (
         <p className="text-xs text-muted-foreground">
           {filingFetching
             ? 'Fetching latest filing status from GSTN…'
             : filingFetched
               ? 'No filing data returned by GSTN for this GSTIN.'
               : 'No filing data captured for this vendor.'}
         </p>
       )}
     </div>
   )}
   ```

   `filingRows` is derived from the same source the inline table uses today: persisted `vendor_validations.details.filing_status` (set during GST verification at registration) with a live `GST_FILING` provider fallback (already implemented in the `useEffect` at lines 301–342). We pass raw `FilingStatusRow[]` to `GstFilingStatusTable` so its own dedupe/sort/format logic runs — same output as registration.

3. Keep everything else in the tab unchanged: the 3 summary cards (Compliance Score / GST Status / Risk Level), the 4-field grid (GSTIN / Registration Date / Filing Status / Last Filed Return), and the Compliance Document section all stay.

4. No changes to data flow, schema, types, edge functions, registration code, or other components. The table renders in **View mode** because the dialog is read-only and the data source (persisted validation + live fetch) already runs whenever the dialog opens for a vendor with a GSTIN.

## Why this works

- Same component (`GstFilingStatusTable`) → identical look & feel to the registration screenshot.
- Same data source (`vendor_validations` GST entry + `GST_FILING` live fallback) that the registration flow writes after the user uploads/verifies the GST certificate, so no extra plumbing is needed.
- Gated on `vendor.gstin` so non-GST (international / unregistered) vendors don't see an empty card.
