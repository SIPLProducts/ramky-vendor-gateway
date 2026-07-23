Change the Vendor Type selector so that the Domestic and International cards always appear in a vertical stack instead of side-by-side on larger screens.

Current state: `VendorTypeSelector.tsx` uses `grid-cols-1 min-[760px]:grid-cols-2`, so the two cards sit next to each other on desktop/tablet widths.

Planned change:
1. In `src/components/vendor/steps/international/VendorTypeSelector.tsx`, remove the two-column breakpoint (`min-[760px]:grid-cols-2`) so the grid remains single-column at all widths.
2. Keep the existing card styling, image fit, selected state, and accessibility attributes unchanged.
3. Verify the selector renders vertically in the preview at the current desktop viewport.

This is a single-file, presentation-only change. No backend, route, or functional logic changes are required.