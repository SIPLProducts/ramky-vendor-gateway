Center-align "Vyapaar Portal" in the Vendor Registration navbar

## Goal
Move the "Vyapaar Portal" title from the left edge to the horizontal center of the navbar on the Vendor Registration screens, while keeping the Ramky logo and action controls on the right.

## Current state
`src/pages/VendorRegistration.tsx` renders its own inline headers in three places:
- Submitted / success screen header (around line 1615)
- Vendor type selection screen header (around line 1655)
- Main registration form header (around line 1711)

In all three, the title is currently left-aligned with `ml-4`.

## Proposed change
1. Refactor each inline header in `src/pages/VendorRegistration.tsx` to a three-column layout:
   - Left: empty spacer or a small back/close element if needed
   - Center: "Vyapaar Portal" title, horizontally centered
   - Right: Ramky logo and action items (Help, AutoSaveIndicator)
2. Use Tailwind classes such as `grid grid-cols-3 items-center` with `text-center` on the center column, or an equivalent flex layout with `flex-1` center column and `justify-center`, so the title remains centered regardless of right-side content width.
3. Keep title styling consistent: `text-lg sm:text-2xl font-bold text-foreground whitespace-nowrap`.
4. Preserve sticky positioning, white background, border, shadow, and mobile padding.

## Verification
- Run `bunx tsgo` (or the project's typecheck command) to confirm no TypeScript errors.
- Visually verify in the preview that the Vendor Registration navbar title is centered on desktop and mobile.
