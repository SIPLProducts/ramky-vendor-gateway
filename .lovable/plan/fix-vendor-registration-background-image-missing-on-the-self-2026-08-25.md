# Fix: Vendor Registration background image missing on the self-hosted server

## What's wrong
The registration screens use the `ramky-brand-bg` background defined in `src/index.css`. Its image URL points to Lovable's CDN path (`/__l5e/assets-v1/...`). That path only exists on Lovable hosting. On the self-hosted server (nginx) the request falls through the SPA rule and returns `index.html` instead of an image, so no background renders.

## Fix
Serve the watermark from the app's own build output instead of the Lovable CDN:

1. Reference a bundled local image (`src/assets/ramky-logo-transparent.png`) in the `.ramky-brand-bg::before` rule so Vite hashes and emits it into `dist/assets/`, making it available on any host.
2. Keep the same visual treatment: fixed, centered, `min(60vw, 620px)`, opacity ~0.12, behind content.
3. No change to the CDN pointer file; it just stops being used for this background.

## Result
The watermark background appears identically on Lovable preview, published Lovable URL, and the self-hosted server — no CDN dependency, no nginx rule needed.

## Technical notes
- Files touched: `src/index.css` only (CSS `url(...)` resolved by Vite at build time, or an equivalent CSS-variable set from a module import if the CSS-relative path needs it).
- Presentation only; no logic, data, or workflow changes.
- Requires a rebuild + redeploy (`npm run build`, then the usual deploy script) for the server to pick it up.
