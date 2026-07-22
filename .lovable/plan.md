## Goal
Make the Vendor Registration landing screen (Select Vendor Type) fit within the viewport at 100% zoom on mobile, tablet, laptop, and desktop — no horizontal scroll and no unnecessary vertical scroll — without touching any functionality.

## Root cause
- The outer container uses `min-h-screen` with a sticky `h-16` header, but `<main>` uses `p-8` and the card stacks two option cards with `p-5` + `h-32` illustrations + heading + big vertical gaps. On short laptop viewports (~700–800px useable height) the card overflows and forces vertical scroll.
- Card width is capped at `max-w-md` which is fine on desktop, but on wide screens the two options stack vertically (wasting horizontal space and forcing scroll). On very small phones the fixed `h-32` image + paddings pushes height further.
- No `overflow-x` guard on the fixed background container.

## Changes (UI/layout only)

### 1. `src/pages/VendorRegistration.tsx` (landing branch, ~lines 1587–1642)
- Change outer wrapper to `min-h-screen` + `overflow-x-hidden`.
- Change `<main>` padding to `p-3 sm:p-6` and allow it to scroll internally only if truly needed: `flex-1 flex items-center justify-center`.
- Card container: bump responsive width so it uses horizontal space on larger screens instead of growing tall:
  - `w-full max-w-md md:max-w-3xl lg:max-w-4xl`
- Inner padding: `p-4 sm:p-5 md:p-6`, `space-y-3 sm:space-y-4`.
- Heading: `text-lg sm:text-xl`; description `text-xs sm:text-sm`.
- Continue button row: keep as-is but `pt-1`.

### 2. `src/components/vendor/steps/international/VendorTypeSelector.tsx`
- Switch layout to responsive grid so cards sit side-by-side on tablet+ and stack on mobile:
  - `grid grid-cols-1 md:grid-cols-2 gap-3 sm:gap-4`
- Reduce per-card vertical footprint:
  - Card padding: `p-3 sm:p-4`
  - Title: `text-base sm:text-[17px]`
  - Illustration: `h-20 sm:h-24 md:h-28` (down from fixed `h-32`), `mt-2`
- Keep all classes, roles, aria, selected badge, onChange behavior unchanged.

### 3. Guard against horizontal overflow globally on this page
- Add `overflow-x-hidden` to the outer background `<div>` so the fixed background image never triggers a horizontal scrollbar on narrow widths.

## Out of scope
- No changes to form logic, routing, state, validation, or the multi-step wizard screens (only the landing "Select Vendor Type" screen and its selector component).
- No color, branding, or copy changes.

## Verification
- Preview at 360px, 768px, 1024px, 1280px, 1440px widths — confirm no horizontal scroll and the card + both options + Continue button fit within viewport height at 100% zoom.
