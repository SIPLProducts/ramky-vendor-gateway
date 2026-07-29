
Scope: `src/components/vendor/VendorReviewDialog.tsx` only — the "View Details" dialog opened from Dashboard / All Vendors / Approval screens.

### 1. Make the selected tab clearly visible
The three tabs (All Details / Documents / GST Compliance Report) inherit the default shadcn active style, which is barely visible on top of the muted TabsList background. Update each `TabsTrigger` to force a distinct active state:
- Active state: white background (`bg-background`), green border (`border-2 border-emerald-500`), emerald text.
- Inactive: transparent background, muted text, no border.
Use `data-[state=active]:...` utilities directly on the triggers so it works without touching the shared shadcn primitive.

### 2. GST Compliance Report — allow scrolling to the bottom
Currently the tab wraps its content in `ScrollArea h-[55vh]`, but the inner filing-status table also has its own `max-h-72 overflow-auto` in `GstFilingStatusTable`, which traps scroll inside the small inner box and hides rows underneath.
- Remove the fixed viewport height and switch the outer container to `flex-1 min-h-0` so the ScrollArea takes all remaining dialog height.
- Pass a prop (or wrap the table) to disable the inner `max-h-72` when rendered inside the review dialog, so scrolling happens only on the outer ScrollArea and every row is reachable.

### 3. Reduce footer whitespace
DialogFooter currently uses `gap-2 mt-4 pt-4 border-t` for a single Close button, producing a large empty strip.
- Tighten to `mt-2 pt-2 border-t` and right-align a compact Close button (`size="sm"`), removing the extra vertical padding.

### 4. SectionCard background — white cards with subtle contrast
All detail sections (Buyer, Vendor, Statutory, Bank, Address, Classification, Financial) use `bg-gradient-to-br from-background to-muted/40` which reads as grey on grey.
- Change `SectionCard` background to solid `bg-card` (white in light theme, still theme-safe for dark mode), keep the left accent bar and rounded border, and lighten the border to `border-border`.
- Keep spacing, header, and icon styling as-is.

### Out of scope
No changes to data fetching, tab structure, or other dialogs. Documents tab and non-review screens remain untouched. `GstFilingStatusTable` gets an opt-in prop only; its default (used elsewhere) stays the same.
