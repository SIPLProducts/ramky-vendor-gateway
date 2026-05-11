# Reuse SAP Sync vendor popup in approval-stage View

The SAP Sync screen shows a rich popup with three tabs — **All Details**, **Documents**, **Validations** — when the reviewer clicks **View**. The same popup should open from the **View** button on every approval-stage screen (SCM Manager, SCM Head, Finance 1, Finance 2, CEO Office). Today those screens use a much simpler dialog with only Overview + Bank + Documents.

## What to build

1. **Extract a shared component** `src/components/vendor/VendorReviewDialog.tsx`
   - Inputs: `vendorId: string | null`, `open: boolean`, `onOpenChange(open)`, optional `footerExtra?: ReactNode` (so SAP Sync can still inject its **Prepare & Sync** button).
   - Internally:
     - Loads the full vendor row via `supabase.from('vendors').select('*').eq('id', vendorId)` (same fields the SAP Sync popup reads).
     - Renders the exact same header (`Building2` icon + legal name + "Review vendor details before syncing to SAP" subtitle — wording stays the same so behaviour matches the screenshots).
     - Renders the existing 3-tab layout copied from `SAPSync.tsx` lines 296–555:
       - **All Details** — Organization, Address, Contact, Statutory, Bank, Financial, Approval Timeline blocks.
       - **Documents** — `<VendorDocuments vendorId={vendor.id} />`.
       - **Validations** — `<ValidationStatus validations={mappedValidations} />` using the same `getValidationsFromVendor` helper (also moved into this component).
     - Footer: always shows **Close**; appends `footerExtra` when provided.

2. **Refactor `src/pages/SAPSync.tsx`**
   - Remove the inline 3-tab JSX and `getValidationsFromVendor` helper.
   - Use `<VendorReviewDialog vendorId={selectedVendor?.id ?? null} open={showDetails} onOpenChange={setShowDetails} footerExtra={<PrepareAndSyncButton/>} />`.
   - Behaviour and styling stay identical to the current screen.

3. **Update `src/components/approvals/StageApprovalView.tsx`**
   - Replace the existing simple view dialog (lines 222–283) with `<VendorReviewDialog vendorId={viewVendor?.id ?? null} open={!!viewVendor} onOpenChange={(o) => !o && setViewVendor(null)} />`.
   - Drop the now-unused `VendorDetails` interface, `openView` fetch logic, and related state — pass the vendor id directly from the row click. The dialog handles its own loading/fetching.
   - This automatically updates all five approval pages (`ScmManagerApproval`, `ScmHeadApproval`, `Finance1Approval`, `Finance2Approval`, `CeoApproval`) since they all render through `StageApprovalView`.

## Out of scope

- No backend / RLS / data changes.
- No changes to the approve / reject action dialog.
- No changes to the SAP sync flow itself — only the popup is shared.

## Verification

- Open each of the five approval pages → click **View** on a pending vendor → confirm the 3-tab popup opens with All Details, Documents, Validations populated and looks identical to the SAP Sync popup (minus the Prepare & Sync button).
- Open SAP Sync → click **View** → confirm nothing visually changed and Prepare & Sync still works.
