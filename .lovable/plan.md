## Goal
Shrink the Domestic and International cards on the Vendor Type selection screen so the flag and map images fit cleanly inside the "Select Vendor Type" panel without cropping, overflow, or page scroll — at every resolution.

## Changes

### 1. `src/components/vendor/steps/international/VendorTypeSelector.tsx`
- Reduce card max width from `max-w-[420px]` to a smaller cap (e.g. `max-w-[300px]`) and center via `mx-auto`.
- Shrink the image container height using a responsive `clamp()` (e.g. `clamp(80px, 14vh, 150px)`) instead of a pure 16:9 aspect ratio, so both cards + label fit inside the panel on short viewports.
- Keep `object-cover` so images fill the frame edge-to-edge without white gaps.
- Tighten internal paddings and label spacing to match the smaller footprint.

### 2. `src/pages/VendorRegistration.tsx`
- Narrow the "Select Vendor Type" panel wrapper (e.g. `max-w-md`, `lg:w-[40%]`) so the whole section is proportional to the reduced cards.
- Keep `h-[calc(100vh-4rem)] overflow-hidden` on `<main>` and the existing inner `overflow-y-auto` safety fallback.

## Result
- Cards become compact (~300px wide, ~150px tall max), stacked vertically.
- Flag and world-map images render fully inside each card at all breakpoints.
- No page scroll on standard laptop/desktop; graceful fallback scroll only on very short viewports.
- No changes to selection logic, routing, or any other functionality.