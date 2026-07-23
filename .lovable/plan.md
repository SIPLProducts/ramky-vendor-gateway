## Problem

On the Select Vendor Type screen, each card is wider than the image's natural aspect, so with `object-contain` there are large white gaps on the left/right of the flag and map. The user wants the image to fill each card edge-to-edge, with no cropping and no gaps, while the panel stays responsive.

## Fix

### 1. `src/components/vendor/steps/international/VendorTypeSelector.tsx`

- Constrain each card to a width that matches the image's aspect ratio, so the image can fill it cleanly:
  - Wrap each `<button>` card in a centered container: `mx-auto w-full max-w-[420px]`.
  - Replace the fixed-height (`clamp(...)`) image container with a natural `aspect-video` (16:9) container.
  - Switch the `<img>` back to `object-cover` — since card width and container aspect now match the source image aspect, cover fills the box without cropping visible content and without side gaps.
- Keep vertical stacking (single column) and the `py-1.5` compact title.

### 2. `src/pages/VendorRegistration.tsx` (choice panel, ~line 1610)

- Keep the panel responsive but slightly wider so a 420px card + padding fits without horizontal squeeze:
  - Change panel widths to `w-[92%] sm:w-[75%] md:w-[60%] lg:w-[50%] max-w-lg`.
  - Keep `h-[calc(100vh-4rem)] overflow-hidden` on `<main>` and compact inner paddings so no page scroll appears.
- Add `overflow-y-auto` on the inner panel content only as a safety net for very short viewports (so the cards themselves never get clipped, but the outer page still doesn't scroll).

### 3. Verification

Playwright headless run at three viewports — 390×844 (mobile), 908×532 (current preview), 1280×800 (desktop). For each: screenshot, confirm both cards fully visible, image fills each card edge-to-edge with no white side gaps, and no page scrollbar.

## Out of scope

- No changes to the flag/map assets themselves.
- No animations reintroduced.
- No changes to the main registration form after Continue.
