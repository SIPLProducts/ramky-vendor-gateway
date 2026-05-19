// Kill-switch service worker. Replaces any previously-installed PWA SW
// so stale caches/navigations stop breaking the Lovable preview.
self.addEventListener("install", (e) => e.waitUntil(self.skipWaiting()));
self.addEventListener("activate", (e) =>
  e.waitUntil(
    (async () => {
      try {
        await self.clients.claim();
        const names = await caches.keys();
        await Promise.all(names.map((n) => caches.delete(n)));
        const clients = await self.clients.matchAll({
          type: "window",
          includeUncontrolled: true,
        });
        await Promise.all(
          clients.map((c) => {
            try {
              const url = new URL(c.url);
              url.searchParams.set("sw-cleanup", Date.now().toString());
              return c.navigate(url.toString());
            } catch {
              return Promise.resolve();
            }
          })
        );
        await self.registration.unregister();
      } catch (err) {
        // best-effort cleanup
      }
    })()
  )
);
self.addEventListener("fetch", () => {});
