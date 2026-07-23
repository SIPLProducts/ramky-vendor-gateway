## Goal

On the "Select Vendor Type" screen, remove page scroll and make the selection card occupy ~50% of the viewport width (instead of the current full-width `max-w-4xl` panel). The two vendor cards (Domestic / International) should scale their image height responsively so both cards + header + Continue button always fit the visible viewport without scrolling, while keeping the flag/map images clearly visible.

## Changes

### 1. `src/pages/VendorRegistration.tsx` (choice screen container, ~line 1610-1636)

- Change outer panel from `max-w-4xl` → `max-w-xl` (roughly 50% of a typical desktop viewport). Add `w-[92%] sm:w-[70%] md:w-[55%] lg:w-[45%]` so it responsively lands near 50% on desktop and stays usable on smaller screens.
- Change `<main>` from `flex items-center justify-center` to also constrain height: `h-[calc(100vh-4rem)] overflow-hidden` so the layout never scrolls (header is `h-16`).
- Reduce vertical paddings/gaps in the inner panel so content always fits: `p-3 space-y-2` on all breakpoints.

### 2. `src/components/vendor/steps/international/VendorTypeSelector.tsx`

- Keep vertical stacking (single column).
- Replace fixed `aspect-[100/57]` image container with a height that adapts to viewport so both cards fit without scroll. Use CSS `clamp` via inline style, e.g. image container height = `clamp(90px, 18vh, 220px)`. This guarantees:
  - On short viewports (e.g. 908×532) each image is ~95px tall → both cards + title + button fit.
  - On tall desktops each image grows up to ~220px for clarity.
- Switch image fitting from `object-fill` back to `object-contain` with `bg-white` — combined with the responsive height, images stay fully visible and undistorted at every resolution.
- Reduce title padding to `py-1.5` to save vertical space.

### 3. Verification

Use Playwright (headless Chromium) to load `/vendor/registration` at three viewports and confirm:
- 908 × 532 (current preview) — no scrollbar, both cards visible, images clear.
- 1280 × 800 desktop — panel ~50% width, both cards visible.
- 390 × 844 mobile — panel ~92% width, no horizontal scroll, images clear.

Capture a screenshot per viewport and inspect.

## Out of scope

- No changes to the Domestic/International image assets themselves.
- No changes to the main registration form after "Continue" is clicked.
- No animation reintroduced (user previously asked for it removed).
