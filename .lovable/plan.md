## Goal
On the Select Vendor Type screen, avoid the vertical scrollbar that appears at 100% zoom. The card and its two options (Domestic / International) should shrink to fit the available viewport height at any zoom / resolution, while remaining fully responsive and preserving all existing behavior.

## Changes

### 1. `src/pages/VendorRegistration.tsx` (landing wrapper)
- Change the outer wrapper from `min-h-screen` to `h-screen` combined with `overflow-hidden` so the page never scrolls; the header + main together always equal viewport height.
- Make `<main>` a flex container that owns the remaining height (`flex-1 min-h-0`) and centers the card.
- Constrain the card with `max-h-full` and make its inner content column a flex column with `min-h-0`, so it never exceeds available space.
- Tighten vertical paddings/gaps on small heights (use `py-2 sm:py-4`, `space-y-2 sm:space-y-3`) so nothing overflows on ~700px viewports at 100% zoom.
- Keep responsive `max-w-md → max-w-xl` widths untouched.

### 2. `src/components/vendor/steps/international/VendorTypeSelector.tsx`
- Make the radiogroup a flex column that fills available height (`flex-1 min-h-0`) with the two cards sharing the space (`flex-1` each, `min-h-0`).
- Replace the fixed illustration heights (`h-20 sm:h-24 md:h-28`) with a fluid `max-h-[18vh]` (with a small floor) plus `flex-1` inside each card so the image scales down when vertical space is tight but keeps aspect ratio.
- Reduce internal paddings on short viewports (`p-2 sm:p-3 md:p-4`) and center title + image vertically so the card looks balanced at any height.

### 3. No functional changes
- Selection state, Continue button, radio semantics, disabled state, background image, header, and all data flow remain identical. Only sizing / overflow rules change.

## Result
- At 100% zoom (and any zoom level / device), the header + card fit within the viewport with no page scrollbar.
- If the viewport becomes very short, illustrations and paddings shrink proportionally instead of forcing a scroll.
- Layout still adapts cleanly across mobile, tablet, laptop, and desktop.
