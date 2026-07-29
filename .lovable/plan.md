# Vendor Type Cards – Remove Inner & Between-Card Empty Space

## Problem
Even after shrinking the outer card, there's still visible empty space:
- Above the "Domestic Vendor" label (between the flag image and the text).
- Between the Domestic and International cards.
- Left/right of the flag and world map images inside each card.

## Changes

### `src/components/vendor/steps/international/VendorTypeSelector.tsx`
1. **Kill horizontal gutters around the image**: the image container uses `object-contain` which leaves whitespace on the sides for wide/narrow images. Switch to `object-cover` and remove the extra `bg-white` around it so the image fills edge-to-edge.
2. **Tighten card internal layout**: reduce card height (`h-[130px]`) and image height (`h-[70px]` filling full width); make the label row use `py-1` with tight `leading-none` so there is no extra space between image and text.
3. **Reduce gap between the two cards**: change grid gap from `gap-1.5 sm:gap-2` to `gap-1`.

### `src/pages/VendorRegistration.tsx` (vendor type gating block, ~lines 1610–1637)
- Reduce top space between the "Select Vendor Type" title and the first card: change `space-y-1` on the inner column to `space-y-0.5` and reduce title bottom margin (use `leading-tight` only, no extra margin).
- Keep outer card at `w-[min(92vw,260px)]` and padding `p-2`.

## Out of scope
- No changes to selection behavior, images themselves, colors, or other steps.

## Verification
- Build passes.
- Preview at 375px, 768px, and 1280px: no visible empty band between flag and "Domestic Vendor" label, no wide side gutters around images, cards sit close together, Continue button remains fully visible below.
