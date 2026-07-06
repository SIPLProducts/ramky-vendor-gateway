## Goal
On the All Vendors screen (`src/pages/VendorList.tsx`), add **Preview** and **Comments** action buttons next to the existing eye/View icon in each row, reusing the exact same components already used in the Approval screens so behavior and UI match 1:1.

## Changes (single file: `src/pages/VendorList.tsx`)

1. **Imports**
   - Add icons: `FileText`, `MessageSquare` (from `lucide-react`, already imported).
   - Import the three dialog components already used by `StageApprovalView`:
     - `VendorSubmissionPreviewDialog` from `@/components/vendor/VendorSubmissionPreviewDialog`
     - `ApprovalCommentsDialog` from `@/components/sap/ApprovalCommentsDialog`

2. **State**
   - `const [previewVendorId, setPreviewVendorId] = useState<string | null>(null);`
   - `const [commentsVendor, setCommentsVendor] = useState<{ id: string; name: string; ref: string } | null>(null);`

3. **Row actions cell (around lines 458–470)** — add two buttons next to the existing View eye button:
   ```tsx
   <Button variant="ghost" size="sm" title="Preview"
     onClick={() => setPreviewVendorId(vendor.id)}>
     <FileText className="h-4 w-4" />
   </Button>
   <Button variant="ghost" size="sm" title="Comments"
     onClick={() => setCommentsVendor({
       id: vendor.id,
       name: pickVendorDisplayName(vendor) || vendor.legal_name || '',
       ref: vendor.reference_number || '',
     })}>
     <MessageSquare className="h-4 w-4" />
   </Button>
   ```

4. **Mount dialogs** once (near the end of the component, alongside the existing details drawer):
   ```tsx
   <VendorSubmissionPreviewDialog
     vendorId={previewVendorId}
     open={!!previewVendorId}
     onOpenChange={(o) => { if (!o) setPreviewVendorId(null); }}
   />
   <ApprovalCommentsDialog
     open={!!commentsVendor}
     onOpenChange={(o) => { if (!o) setCommentsVendor(null); }}
     vendorId={commentsVendor?.id ?? null}
     vendorName={commentsVendor?.name}
     referenceNumber={commentsVendor?.ref}
   />
   ```

## Notes
- No changes to the Preview or Comments dialogs themselves — they already render the full vendor preview (documents, details) and the full approval comment history (approver name, stage, level, status, remarks, date/time) exactly as shown on the Approval screens.
- No backend/schema changes. RLS already permits admins/sharvi_admin (who view All Vendors) to read `vendor_approval_progress` and `vendors`.
- Existing eye/View button and details drawer remain unchanged.