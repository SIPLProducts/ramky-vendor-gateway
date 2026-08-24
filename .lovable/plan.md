# Fix Incomplete Logo in Login Left Panel

The watermark logo in the login page's left panel is missing parts of the mark. The cause is the logo image file itself, not the layout: the current transparent logo asset is a squared 1024x1024 crop whose artwork runs into the edges, so the small orange square on the left, the green square on the right, and parts of the "Towards sustainable growth" tagline are clipped.

## Change

- Replace the transparent Ramky logo asset with a clean transparent version generated from the newly uploaded full logo, keeping the original aspect ratio (wider than tall) plus a small breathing margin so nothing touches the edges.
- Keep the same import path so every place that already uses the logo (login watermark, top-right login logo, mobile logo, navbars, registration headers) picks up the corrected image automatically.
- Adjust the login watermark sizing for the wider aspect ratio so the whole mark sits inside the left panel.
- Update the favicon from the uploaded brand mark (square, padded, not stretched).

## Technical detail

- Create a background-removed, non-cropped PNG at `src/assets/ramky-logo-transparent.png` from `user-uploads://Ramky_Group_Logo_Final.png`, preserving its native proportions with transparent padding.
- `src/pages/Auth.tsx`: retune the watermark `<img>` width for the wider image (e.g. `w-[30rem] max-w-[42vw]`), keeping `opacity-[0.07]`, `pointer-events-none`, and the bottom-left placement.
- Add `public/favicon.png` (64x64, padded square) and point `index.html`'s icon link at it, removing `public/favicon.ico`.
