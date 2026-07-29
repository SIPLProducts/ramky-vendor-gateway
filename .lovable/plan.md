# Vendor Type Selection Screen – UI Layout Fix

## Goal
Tighten the Select Vendor Type screen so the main card fits its content without large blank areas, the vendor type cards are shorter and balanced, and the Continue button sits cleanly below the cards without overlapping.

## Current state (verified)
- Vendor type cards are fixed at `150px × 200px` with a `70px` image container (`src/components/vendor/steps/international/VendorTypeSelector.tsx`).
- The gating screen in `src/pages/VendorRegistration.tsx` renders the card inside a `h-[calc(100vh-4rem)]` centered container with `max-w-sm`, `overflow-hidden`, and an inner `overflow-hidden` wrapper.
- The card uses `space-y-1.5` spacing; the Continue button is at the bottom right.
- The overlap seen in the preview comes from the fixed 200px card heights plus the `overflow-hidden` clipping in the parent card, which pushes the button over the second card on smaller viewports.

## Changes to make

### 1. Reduce vendor type card size
**File:** `src/components/vendor/steps/international/VendorTypeSelector.tsx`
- Lower card height from `200px` to **160px** while keeping the 150px width.
- Lower the image container height from `70px` to **55px** so the image/label ratio stays balanced.
- Keep the selected badge, green ring, rounded-xl corners, shadow, and white label area unchanged.
- Ensure both Domestic and International cards remain equal height.

### 2. Tighten the main card layout
**File:** `src/pages/VendorRegistration.tsx` (vendor type gating block)
- Reduce the card’s internal padding from `p-2 sm:p-2.5` to a smaller uniform value (e.g., `p-2`).
- Reduce the gap between title, selector, and button from `space-y-1.5` to `space-y-1` or use a `gap` on a flex column.
- Remove the inner `overflow-hidden` so content is not clipped; keep vertical scrolling available on very short viewports if needed (`overflow-auto` instead of `overflow-hidden`).
- Let the card height grow to fit content rather than forcing `max-h-full` with clipping.
- Keep the card horizontally centered and the glassmorphism background/border unchanged.

### 3. Fix Continue button position
- Place the Continue button in a dedicated footer row below the `VendorTypeSelector` with `pt-1` (or equivalent gap) so it always sits after the cards.
- Keep the button right-aligned and its current size/class.
- Ensure no negative margins or absolute positioning cause overlap.

### 4. Responsive behavior
- The card container should remain centered (`flex items-center justify-center`) but no longer clip the button when the two cards + button exceed the viewport height.
- On very short screens, allow the inner card to scroll instead of overflowing.
- Keep existing breakpoints (`sm`, `md`, `lg`) for card width percentages.

## Verification
- Build the project and confirm no TypeScript/Tailwind errors.
- Check the preview at common viewport sizes (desktop ~1280px, tablet ~768px, mobile ~375px) to confirm:
  - Both cards are shorter and equal height.
  - Title, cards, and button have consistent vertical spacing.
  - The Continue button is fully visible below the International Vendor card and does not overlap.
- No functional changes to vendor selection logic or navigation.

## Out of scope
- No changes to vendor selection state, form flow, or the Continue action logic.
- No color/theme changes beyond the existing card styling.
- No changes to other registration steps.