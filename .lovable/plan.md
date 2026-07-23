## Goal
Make the Domestic (Indian flag) and International (world map) images fully and clearly visible by increasing the image container height.

## Changes

### `src/components/vendor/steps/international/VendorTypeSelector.tsx`
- Increase the image container height from `clamp(80px, 14vh, 150px)` to a taller cap — up to `400px` — e.g. `clamp(180px, 32vh, 400px)`.
- Switch the image from `object-cover` to `object-contain` so the entire flag / world map is visible without cropping (cover was cutting edges when the container grew taller than the image aspect).
- Keep card `max-w-[300px]` and existing layout; only the image frame grows.

### `src/pages/VendorRegistration.tsx`
- No structural change needed. The panel already has `overflow-y-auto` as a fallback if the taller cards exceed viewport height on very short screens.

## Result
- Image frame scales up to 400px tall on large screens.
- Full flag and world map render inside each card with no cropping.
- Layout stays responsive; scroll appears only on unusually short viewports.