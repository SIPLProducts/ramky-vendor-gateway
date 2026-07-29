Modify `src/components/vendor/steps/international/VendorTypeSelector.tsx` to resize the vendor type cards as requested.

**Current state:**
- Cards are `w-full max-w-[280px] mx-auto` with auto height driven by content.
- The image container uses `height: clamp(128px, 28vh, 205px)`.

**Changes to make:**
1. Set a fixed card size of **150px width × 200px height**.
2. Set the image container height to **70px**.
3. Keep the existing rounded styling, selected badge, shadow, and label area.
4. Ensure the layout remains centered and responsive within its parent grid.

**Implementation approach:**
- Change `max-w-[280px]` to `w-[150px] h-[200px]`.
- Change the inline image height from `clamp(128px, 28vh, 205px)` to `70px`.
- Verify text and badge still fit within the reduced card height.