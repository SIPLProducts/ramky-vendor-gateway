## Problem

1. Tab labels ("All Details", "Documents", "GST Compliance Report") are visually bisected by the `TabsList` bottom border — the triggers have no explicit height and `-mb-px` pushes text across the underline.
2. The "GST Return Filing Status" sub-header inside the filing card is redundant with the tab title.

## Fix

### `src/components/vendor/VendorReviewDialog.tsx`
- Add `h-11 items-end` to the `TabsList` so it has a fixed height and triggers align to the bottom border.
- Change each `TabsTrigger` to `h-10 items-center` with `-mb-[1px]` and `border-b-2 border-transparent data-[state=active]:border-b-white` so the active tab's white bottom edge cleanly covers the container border (creating the connected-tab effect). Non-active triggers stay muted with just a bottom border color transition.
- Bump `TabsContent` top margin back to `mt-4` so cards don't hug the tab bar.

### `src/components/vendor/kyc/GstFilingStatusTable.tsx`
- Remove the header block (`<div className="px-4 py-2.5 border-b bg-muted/40">` containing "GST Return Filing Status" and subtitle). Table renders directly inside its bordered container.

## Verification
Open View Details → tab labels fully visible above the border with clean active/inactive states; GST Compliance tab shows summary + filing table without the extra "GST Return Filing Status" sub-header.
