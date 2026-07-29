## Problem
In `VendorReviewDialog` → **GST Compliance Report** tab:
1. Vertical scrolling gets stuck / doesn't reach the bottom (nested scroll areas: outer `ScrollArea h-[55vh]` + inner `GstFilingStatusTable` uses `max-h-72 overflow-auto`, and the tab wrapper isn't sized to the dialog's flex layout).
2. Excessive padding — the summary fields (GSTIN, Registration Date, Filing Status, Last Filed Return) are laid out as a 2-column grid, wasting vertical space.
3. `TabsList` selected state is not visually distinct — the active tab (e.g. "GST Compliance Report") is not clearly highlighted.

## Fix (presentation only, `src/components/vendor/VendorReviewDialog.tsx`)

1. **Single-row summary**: change the summary grid from `grid-cols-2` to `grid-cols-2 md:grid-cols-4` so GSTIN, Registration Date, Filing Status, Last Filed Return all sit on one row on desktop.

2. **Fix scroll**: 
   - Replace the fixed-height `ScrollArea h-[55vh]` inside the GST tab with `h-full` (the parent `TabsContent` is already `flex-1 overflow-hidden`), so the scroll area fills whatever height remains in the dialog and always scrolls to the bottom.
   - Remove the inner scroll on the filing-status table wrapper (`max-h-72 overflow-auto` in `GstFilingStatusTable.tsx`) so the outer ScrollArea owns the scroll and nested-scroll trapping goes away. Since the table is limited to the last 3 rows here, no inner scroll is needed.
   - Do the same `h-full` change for the "All Details" ScrollArea for consistency.
   - Tighten padding: reduce `space-y-6` to `space-y-4` in the GST tab content and remove the extra `mt-4` on `TabsContent` (use `mt-2`).

3. **Selected tab visibility**: update the three `TabsTrigger`s in this dialog to add a `data-[state=active]` variant that renders a light white background with a green border and green text, e.g. `data-[state=active]:bg-white data-[state=active]:border data-[state=active]:border-emerald-500 data-[state=active]:text-emerald-700 data-[state=active]:shadow-sm`. Applied inline on each trigger so it only affects this dialog and doesn't change the global Tabs component.

No logic, data fetching, or other tabs/screens are affected.

## Technical notes
- Files touched:
  - `src/components/vendor/VendorReviewDialog.tsx` — TabsTrigger classes, summary grid, ScrollArea heights, spacing.
  - `src/components/vendor/kyc/GstFilingStatusTable.tsx` — drop the inner `max-h-72 overflow-auto` wrapper (keep `rounded-lg border` container). This table is also used in `VendorSubmissionPreviewDialog` where `limit=3`, so removing the inner scroll is safe.
