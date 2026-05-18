## Goal
Add a scrollable area to the SAP Sync result dialog so long SAP response lists don't push the dialog off-screen.

## Change
File: `src/pages/SAPSync.tsx` (SAP Sync Result Dialog, around lines 271–347)

1. Constrain the dialog's vertical size so it never exceeds the viewport: change `DialogContent` className from `rounded-2xl max-w-2xl` to `rounded-2xl max-w-2xl max-h-[85vh] flex flex-col`.
2. Wrap the result body (the `{sapSyncResult && (...)}` block, lines 295–347) in a `<ScrollArea className="flex-1 max-h-[65vh] pr-4">` so the success banner + SAP Response Details list scrolls inside the dialog while the header and footer stay fixed.
3. Import `ScrollArea` from `@/components/ui/scroll-area` at the top of the file.

## Out of scope
- No changes to data, sync logic, or response rendering.
- No changes to other dialogs (`SapFieldsDialog`, `VendorReviewDialog`, etc.).
