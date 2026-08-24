# Clean up the login page brand watermark

The screenshot shows the Ramky watermark running off the left edge of the screen and bleeding under the headline text, which looks unintentional.

## What changes

- Keep the watermark fully inside the left branding panel: no part of the logo touches or crosses the screen edge, and it never overlaps the headline or paragraph.
- Place it in the lower-left area of the branding panel, sized so the full mark plus tagline is visible (roughly a third of the panel width, capped on small screens).
- Soften it to a true watermark (about 8–10% opacity) so it reads as texture behind the panel rather than a second logo competing with the top-right logo.
- Add clear breathing room: comfortable margin from the panel's left edge and bottom, and vertical separation from the text block above.
- Hide the watermark entirely on mobile, where the panel collapses and it only adds noise behind the sign-in card.

## Technical notes

All changes are in `src/pages/Auth.tsx` presentation only:
- Move the watermark `<img>` from the page-level container into the left branding panel (`relative` parent) so it is clipped/positioned by the panel, with `overflow-hidden` on that panel.
- Replace `left-6 bottom-16 w-[28rem] max-w-[40vw] opacity-[0.14]` with panel-relative positioning, a percentage width, `object-contain`, lower opacity, and `hidden md:block`.
- No logic, asset, or copy changes.
