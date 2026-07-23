## Problem
1. White gaps around the images: `object-contain` on a 16:9 image inside a card whose aspect ratio doesn't match the image causes letterboxing (side gaps when card is taller than 16:9, top/bottom gaps when wider). Setting a colored background just makes the gap visible instead of white.
2. Wave/float animations feel jittery and cheap.

## Fix

### `src/components/vendor/steps/international/VendorTypeSelector.tsx`
- Give the image container a **fixed 16:9 aspect ratio** (`aspect-[16/9]`) that matches the source images (1600×900). Remove `min-h-[140px]` and the gradient background — no longer needed.
- Switch back to `object-cover` on the `<img>`. With matching aspect ratio + cover, the entire image fills the box with zero gaps on any viewport width. No cropping either, because ratios match.
- Drop the wave/float/shine animations and replace with a **Ken Burns** effect (slow, premium, no jitter):
  - Continuous slow zoom + subtle pan (`scale(1) translate(0,0)` → `scale(1.06) translate(-1.5%, -1%)` → back), ~14s ease-in-out infinite. Feels cinematic, not shaky.
  - Card hover: gentle lift (already there) + slight extra zoom on the image (`group-hover:scale-[1.08]`) with a smooth 700ms transition.
  - Entry: keep the staggered `animate-fade-in` on mount.
  - Selected: keep the green ring + soft outer glow.
- Remove `flag-wave`, `map-float`, `shine-sweep` keyframes usage from the component.

### `tailwind.config.ts`
- Remove the now-unused `flag-wave`, `map-float`, `shine-sweep` keyframes and animations.
- Add one new keyframe/animation: `ken-burns` (14s ease-in-out infinite).

### Do not touch
- Vendor Registration page, image files, on-behalf flow, classification logic, or any other component.

## Verification
- Build succeeds.
- No white gaps around either image at any viewport width; both images fully visible edge-to-edge.
- Motion feels slow and premium, not jittery.
