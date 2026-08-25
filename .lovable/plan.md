# Move "Vyapaar Portal" title to the left in public/vendor registration header

## Goal
Shift the "Vyapaar Portal" title from the center to the left side of the public header used on the vendor registration and other public pages, with a small left margin so it matches the post-login navbar styling.

## Current state
`PublicHeader.tsx` uses a three-column flex layout:
- Left: empty spacer
- Center: "Ramky Vyapaar Portal" title
- Right: Help, Feedback, and Ramky logo

## Changes
1. **PublicHeader.tsx**
   - Move the `<h1>` title block to the left side of the header.
   - Add a left margin of `ml-4` so it sits slightly inset from the edge.
   - Keep the right-side group (Help, Feedback, logo) aligned to the end with `justify-end`.
   - Update title text from "Ramky Vyapaar Portal" to "Vyapaar Portal" for consistency with the authenticated headers.

## Styling rules
- Preserve current font size (`text-2xl`), `font-bold`, `tracking-wide`, and `whitespace-nowrap`.
- Keep the existing background, border, height, and sticky positioning unchanged.
- Ensure the title does not overlap or crowd the left edge by using `ml-4`.

## Verification
- Build the app and confirm no compilation errors.
- Check the vendor registration page header renders "Vyapaar Portal" on the left with visible left margin and Help/Feedback/logo on the right.
