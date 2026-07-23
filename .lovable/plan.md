## Problem
At 100% viewport zoom the card image area is short and wide, so `object-cover` on the 16:9 flag/map crops out most of the image — the Indian flag only shows the white middle band with the chakra, and the world map loses top/bottom continents. It looks broken.

## Fix

### `src/components/vendor/steps/international/VendorTypeSelector.tsx`
- Switch the image `<img>` from `object-cover` to `object-contain` so the entire flag / entire world map is always visible regardless of card aspect ratio. No more cropping the chakra or the continents.
- Give the image area a subtle branded background (light slate gradient) so `object-contain` letterboxing looks intentional instead of empty white gaps.
- Guarantee a minimum image height (`min-h-[140px]`) so short viewports still show a readable image.
- Add tasteful, lightweight animations (no new libraries — reuse existing Tailwind `animate-fade-in` and CSS transforms):
  - Card entry: staggered `animate-fade-in` on mount (delay 0ms / 120ms).
  - Flag: gentle continuous `wave` sway (subtle skew + translate keyframe, ~6s ease-in-out infinite) so the domestic flag feels alive.
  - Map: slow continuous `float` (translateY 0 → -4px → 0, ~5s ease-in-out infinite) plus a soft pulsing glow behind it.
  - Hover: existing lift + a light shine sweep (diagonal gradient translating across the image once on hover) for polish.
  - Selected state: keep the green ring; add a soft outer glow pulse.
- Keep title bar, Selected badge, click handler, and radio semantics unchanged.

### `tailwind.config.ts`
- Add two keyframes + animations used above: `flag-wave` and `map-float`. No other config changes.

### Do not touch
- Vendor Registration page, image files, on-behalf flow, classification logic, or any other component.

## Verification
- Build succeeds.
- At 100% zoom (908×532 viewport): full Indian flag visible with gentle wave motion; full world map visible with gentle float motion; no cropping of chakra or continents.
- At larger viewports: images scale up cleanly, animations remain subtle and non-distracting.
