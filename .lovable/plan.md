# Vendor Type Screen – Remove Wide Empty Side Space & Make Responsive

## Problem
The main "Select Vendor Type" card is narrow (`max-w-sm`, ~384px) but its inner vendor cards are fixed at `150px` wide, leaving large empty vertical strips on the left and right of both cards (the areas circled in red).

## Changes

### 1. `src/components/vendor/steps/international/VendorTypeSelector.tsx`
- Remove the fixed `w-[150px]` on each vendor card; make them fluid: `w-full max-w-[200px]` and keep `mx-auto`.
- Keep card height compact (`h-[160px]`) and image container at `55px`.
- Keep the grid `grid-cols-1 gap-2` so Domestic stacks above International.

### 2. `src/pages/VendorRegistration.tsx` (vendor type gating block, ~lines 1610–1637)
- Tighten the outer card width so it hugs content instead of stretching to `max-w-sm` with empty sides:
  - Replace `w-[88%] sm:w-[60%] md:w-[48%] lg:w-[38%] max-w-sm` with a snug, responsive width: `w-[min(92vw,260px)]`.
- Keep the glassmorphism styling, padding (`p-2`), spacing (`space-y-1`), title, and Continue button placement unchanged.
- Continue button stays right-aligned in its own footer row (already correct after previous fix).

### 3. Responsive behavior
- On mobile (≤400px): card fits within 92vw, vendor cards scale up to 200px width, no horizontal empty gutters.
- On tablet/desktop: card stays a compact 260px centered on screen; vendor cards fill it edge-to-edge (minus padding), eliminating the wide side space seen in the screenshot.
- Vertical layout, selected badge, ring, and Continue button behavior are unchanged.

## Out of scope
- No changes to selection logic, navigation, images, or other steps.
- No color/theme changes.

## Verification
- Build passes.
- At 375px, 768px, and 1280px viewports: vendor cards fill the container width with no empty side strips; Continue button remains fully visible below the International card.
