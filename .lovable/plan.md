## Root cause

The recurring broken-document preview is caused by the existing PWA/service worker setup, not by the SAP/DMS work.

Current code still ships `vite-plugin-pwa` with aggressive service-worker behavior (`clientsClaim`, `skipWaiting`, auto-update). The app also registers update listeners in `src/main.tsx` even inside Lovable preview. In the editor iframe, Lovable uses long rotating preview-token URLs; once a service worker claims that iframe, it can serve stale cached navigation responses or trigger reloads against expired/protected preview URLs. That is why the issue comes back repeatedly.

## Fix plan

1. **Harden `vite.config.ts` PWA config**
   - Disable PWA/service worker in development preview.
   - Add a navigation denylist for Lovable preview/token/internal paths.
   - Add a `NetworkFirst` strategy for HTML navigations so the app shell is not locked to stale cache.
   - Keep asset/API caching for the published app only.

2. **Update `src/main.tsx` preview guard**
   - Detect Lovable preview hosts and iframe context before mounting React.
   - In those contexts, unregister all service workers and delete all caches.
   - Do **not** attach `updatefound`, `focus reg.update()`, or `controllerchange reload` listeners in preview/iframe.
   - Keep update notification/reload logic only for real published/non-preview usage.

3. **Add a service-worker kill switch at `public/sw.js`**
   - This cleans up service workers already installed in affected browsers.
   - It will claim clients, delete existing caches, navigate open pages once with a cleanup marker, then unregister itself.
   - This is needed because simply changing config does not remove an already-installed service worker from users’ browsers.

4. **Leave SAP/DMS logic untouched**
   - No changes to DMS payload, middleware, backend functions, database, or vendor workflow.
   - This fix is limited to the preview/PWA layer causing the recurring broken preview.

## Expected result

The Lovable preview iframe will stop being controlled by a service worker, so stale/expired preview-token navigations should stop showing the broken-document page. The published app can still keep PWA behavior, but with safer navigation caching.