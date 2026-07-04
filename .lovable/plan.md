## Goal
On every approval screen (Buyer, SCM CO, SCM Head, Finance 1, Finance 2, CEO Office), show a "Comments" button beside the Preview button in each row — matching the behavior already present on the SAP Sync screen. Clicking it opens the existing `ApprovalCommentsDialog` showing full approval history (stage, approver, status, comment, timestamp).

## Changes

**`src/components/approvals/StageApprovalView.tsx`** (single file — powers all six approval pages)

1. Import `MessageSquare` from `lucide-react` and `ApprovalCommentsDialog` from `@/components/sap/ApprovalCommentsDialog`.
2. Add state:
   ```ts
   const [commentsVendor, setCommentsVendor] = useState<StageApprovalItem | null>(null);
   ```
3. In both `renderTable` (pending/waiting rows) and `renderRejectedTable` (rejected rows), insert a new button between the Preview button and Approve/next button:
   ```tsx
   <Button size="sm" variant="outline" onClick={() => setCommentsVendor(it)}>
     <MessageSquare className="h-4 w-4 mr-1" /> Comments
   </Button>
   ```
4. At the bottom of the component (alongside other dialogs), render:
   ```tsx
   <ApprovalCommentsDialog
     open={!!commentsVendor}
     onOpenChange={(o) => !o && setCommentsVendor(null)}
     vendorId={commentsVendor?.vendorId ?? null}
     vendorName={commentsVendor?.vendorName}
     referenceNumber={commentsVendor?.referenceNumber}
   />
   ```

No changes to backend, data hooks, or the six per-stage page files — they all render through `StageApprovalView`, so this single edit covers all approval screens.
