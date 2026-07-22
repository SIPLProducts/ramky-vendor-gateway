## Problem

The vendor registration background image works locally but not on the self-hosted server (vendx.ramky.com).

**Root cause:** `src/assets/vendor-type-bg.png.asset.json` points to a Lovable CDN URL:
```
/__l5e/assets-v1/4254ca45-.../vendor-type-bg.png
```
That path is served only by Lovable's preview/publish infrastructure. The self-hosted Nginx server has no such route, so the request 404s and the background never renders.

## Fix

Replace the Lovable-CDN asset pointer with a real image file bundled into the Vite build so it deploys with `dist/` on any host.

### Steps

1. Download the actual PNG from the Lovable CDN into the repository as `src/assets/vendor-type-bg.png` (real binary, ~2.8 MB).
2. Update `src/pages/VendorRegistration.tsx`:
   - Change import from `@/assets/vendor-type-bg.png.asset.json` to `@/assets/vendor-type-bg.png`.
   - Change `url(${vendorTypeBgAsset.url})` to `url(${vendorTypeBg})`.
3. Delete `src/assets/vendor-type-bg.png.asset.json` (no longer needed).

### Why this works

Vite fingerprints imported image files into `dist/assets/…` at build time. `scripts/lib/60-frontend.sh` already rsyncs `dist/` to the Nginx root, so the image ships with the frontend bundle and loads from the same origin as the app — no dependency on Lovable's CDN.

No other files reference this asset, and no backend/database change is needed.
