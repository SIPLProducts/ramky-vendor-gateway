## Problem

In the **View Details** popup (`VendorReviewDialog`):

1. **Tabs look broken/overlap with body** — on narrow viewports (e.g. 908px preview) the inactive tab labels ("Documents", "GST Compliance Report") visually disappear against the `bg-muted` bar, and only the active tab's rounded border shows as a floating half-arc that appears to overlap the first card underneath (screenshot 1).
2. **GST Filing table not fully visible** — the GST Compliance tab's header + summary grid + table are stacked without a proper flex/scroll container, so only 1 row of the filing table renders and the rest is clipped below the dialog footer (screenshot 3).
3. **Documents tab** — Uploaded Documents card sits fine but the outer scroll + inner card create double borders (screenshot 2).

Root cause: the `TabsList` uses `bg-muted` with no explicit inactive text color/border for triggers, so on small widths the labels blend in and the only visible thing is the emerald border of the active trigger. In the GST tab, the summary grid is a direct child of `ScrollArea` while the table lives in its own bordered card without a flex layout — table body is pushed off-screen.

## Fix

### 1. `src/components/vendor/VendorReviewDialog.tsx` — TabsList redesign

Replace the current `TabsList` with a clean, always-visible segmented control:

- Container: `flex w-full gap-1 border-b border-border bg-transparent p-0 h-auto rounded-none` (remove `bg-muted` and grid).
- Each `TabsTrigger`: `flex-1 justify-center gap-2 rounded-t-md rounded-b-none border border-transparent border-b-0 px-3 py-2 text-sm text-muted-foreground hover:text-foreground data-[state=active]:bg-white data-[state=active]:border-emerald-500 data-[state=active]:text-emerald-700 data-[state=active]:shadow-none -mb-px`.
- The `-mb-px` and shared bottom border make the active tab visually connect to the content pane, eliminating the "floating arc overlapping body" look.
- Add `mt-3` (not `mt-4`) on `TabsContent` for tighter spacing.

### 2. GST Compliance tab layout

Restructure the `gst_compliance` panel so the summary sits fixed at top and only the table area scrolls:

```
<TabsContent value="gst_compliance" className="mt-3 flex-1 min-h-0 flex flex-col gap-3">
  {/* Summary row — no scroll */}
  <div className="grid grid-cols-2 md:grid-cols-4 gap-3 text-sm shrink-0 px-1">...</div>

  {/* Scrollable table area */}
  <div className="flex-1 min-h-0 overflow-auto pr-1">
    <GstFilingStatusTable ... />
  </div>
</TabsContent>
```

This removes the redundant nested `ScrollArea` and ensures the filing table gets full remaining vertical space with its own scrollbar, so all 3 return rows render.

### 3. Documents tab — remove double border

Change:
```
<TabsContent value="documents" className="mt-3 flex-1 min-h-0 overflow-auto pt-1">
```
The `pt-1` and outer `ScrollArea`-vs-card overlap goes away once the TabsList shares a border with the content.

### 4. Details tab — same spacing update

`<TabsContent value="details" className="mt-3 flex-1 min-h-0 overflow-hidden">` and keep the inner `ScrollArea h-full pr-4`. Use `min-h-0` so the flex child actually shrinks and scrolls instead of pushing footer.

### 5. Dialog container

`DialogContent` already has `max-h-[90vh] overflow-hidden flex flex-col` — add `min-h-0` on the `Tabs` root: `className="w-full flex-1 min-h-0 overflow-hidden flex flex-col"` to make the flex chain honor the viewport height and stop content from bleeding past the footer.

## Files touched

- `src/components/vendor/VendorReviewDialog.tsx` — TabsList + all three TabsContent panels + Tabs root class.

No changes to `GstFilingStatusTable.tsx` (already has correct inner markup); no logic/data changes.

## Verification

- Load View Details popup at 908×532 viewport (current preview size) → all 3 tab labels visible with clear inactive/active states, no floating arc.
- Switch to Documents → uploaded docs list scrolls inside tab without double border.
- Switch to GST Compliance → summary row on top, filing table below with its own scroll showing all rows.
- Resize to desktop and mobile → tabs wrap gracefully, table remains scrollable.
