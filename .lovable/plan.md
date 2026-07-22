I understand — you want the Domestic and International vendor type cards to always stack vertically, one above the other, rather than sitting side-by-side on larger screens, while keeping the layout fully responsive.

**Plan**

1. **Update the vendor type selector** in `src/components/vendor/steps/international/VendorTypeSelector.tsx`:
   - Change the grid from `grid-cols-1 md:grid-cols-2` to a single-column `grid-cols-1` layout so cards always stack vertically.
   - Adjust card padding, image height, and spacing for mobile/tablet/desktop so the cards scale proportionally without overflowing.
   - Keep the existing selection state, hover/selected styles, and accessibility intact.

2. **Adjust the landing container** in `src/pages/VendorRegistration.tsx`:
   - Review the max-width and padding of the card that wraps the selector so the vertical stack fits cleanly on all viewports.
   - Tighten spacing if needed to avoid unnecessary vertical scroll.

3. **Verify responsive behavior** across breakpoints (mobile, tablet, laptop, desktop) so cards remain aligned, centered, and properly sized without affecting any existing functionality.

This is purely a layout change — no logic, data flow, or selection behavior will be modified.