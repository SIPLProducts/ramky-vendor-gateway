## Goal
Make the View popup on the All Vendors screen identical to the "View Details" popup shown on the approval screens.

## Change
Edit `src/pages/VendorList.tsx` only:

1. Import `VendorReviewDialog` from `@/components/vendor/VendorReviewDialog`.
2. Remove the large inline `<Dialog>...</Dialog>` block (currently rendered when `showDetails` is true) that renders vendor details tabs locally, along with any state/helpers used solely by it that are no longer needed (`showDetails` stays; the local rendering is replaced).
3. Replace it with:
   ```tsx
   <VendorReviewDialog
     vendorId={selectedVendorId}
     open={showDetails}
     onOpenChange={(o) => { if (!o) { setShowDetails(false); setSelectedVendorId(null); } }}
   />
   ```
4. Keep the Eye button behavior (sets `selectedVendorId` and opens `showDetails`) and the `title="View"` tooltip unchanged.
5. Remove now-unused imports (`Dialog`, `DialogContent`, etc.) only if they aren't used by the remaining dialogs on the page (the Return-to-vendor dialog still uses them, so keep them if so).

## Out of scope
No changes to the approval screens, `VendorReviewDialog`, columns, filters, or export.
