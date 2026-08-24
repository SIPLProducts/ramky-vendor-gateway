# Login panel watermark — verify and polish

Your screenshot shows the old state (oversized logo cut off at the left edge, running under the text). A fresh capture of the running app shows the watermark already contained inside the left panel, so the screenshot is a stale/cached view — a hard refresh (Ctrl+Shift+R) will show the current version.

On top of that, a small polish pass so the left panel feels deliberate.

## What changes

- Align the watermark's left edge exactly with the headline and paragraph text, so the panel reads on one clean vertical line.
- Nudge its size and opacity so the full mark plus "Towards sustainable growth" tagline is legible as a soft brand texture, still clearly behind the text.
- Keep a consistent gap below the paragraph and above the bottom of the viewport at common screen heights, so it never crowds the copy or clips.
- Remains hidden on mobile and never overlaps the sign-in card.

## Technical notes

- `src/pages/Auth.tsx` only, presentation classes on the watermark `<img>` inside the left branding panel (left offset matched to the panel padding, width/opacity tuned). No logic, asset, or copy changes.
