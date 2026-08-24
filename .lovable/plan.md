# Fix Incomplete Logo in Login Left Panel

The watermark logo in the login page's left panel is missing parts of the mark. The cause is the logo image file itself, not the layout: the current transparent logo asset is a squared 1024x1024 crop whose artwork runs into the edges, so the small orange square on the left, the green square on the right, and parts of the "Towards sustainable growth" tagline are clipped.

## Change

- Replace the transparent Ramky logo asset with a clean transparent version generated from the newly uploaded full logo, keeping the original aspect ratio (wider than tall) plus a small breathing margin so nothing touches the edges.
- Keep the same import path so every place that already uses the logo (login watermark, top-right login logo, mobile logo, navbars, registration headers) picks up the corrected image automatically.
- Adjust the login watermark sizing and placement so the whole mark sits inside the left panel and is clearly visible.
- Update the favicon from the uploaded brand mark (square, padded, not stretched).

## Technical detail

- Create a background-removed, non-cropped PNG at `src/assets/ramky-logo-transparent.png` from `user-uploads://Ramky_Group_Logo_Final.png`, preserving its native proportions with transparent padding.
- `src/pages/Auth.tsx`: update the watermark `<img>` to use a slightly smaller width for the wider image (`w-[30rem] max-w-[42vw]`), move it up from `bottom-8` to `bottom-16` (or `bottom-20`) so the full logo is visible in the left panel, and raise opacity from 7% to ~14% (`opacity-[0.14]`) so the mark reads faintly but clearly.
- Add `public/favicon.png` (64x64, padded square) and point `index.html`'s icon link at it, removing `public/favicon.ico`.

