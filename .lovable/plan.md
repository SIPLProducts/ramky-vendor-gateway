## 1) DMS sync — batch all files in ONE request (no size fallback)

**Current behaviour** (`supabase/functions/sync-vendor-to-dms/index.ts`):
The function loops through each `vendor_documents` row and POSTs to the middleware **once per file**. That is why your response shows 4 separate `sapRows` entries for a single vendor — 4 files = 4 SAP calls. The browser only sends `{ vendorIds: [...] }`; the base64 payload is built server-side inside the Edge Function, which is why you don't see it in the request payload from the browser.

**New behaviour**
1. For each vendor, download every document from Storage and base64-encode it.
2. Build a single payload:
   ```json
   {
     "BP_LIFNR": "0001017573",
     "FILE_UPLOAD": [
       { "FILE": "<base64_1>", "FILE_PATH": "C:/Users/ADMIN/OneDrive/Desktop/..." },
       { "FILE": "<base64_2>", "FILE_PATH": "..." },
       { "FILE": "<base64_3>", "FILE_PATH": "..." },
       { "FILE": "<base64_4>", "FILE_PATH": "..." }
     ]
   }
   ```
3. POST **once** to the DMS middleware endpoint.
4. Parse the returned array — one row per file — and mark each file success where `MSGTYP === "S"`. Failures get mapped back to their `FILE_PATH` / file name in `failedDocuments`.
5. **No per-file fallback and no payload-size guard.** The `PAYLOAD_TOO_LARGE` special-case and the per-file retry loop will be removed entirely. nginx is configured for 500 MB and the middleware body limit is unset, so the batched call must go through as-is; if the middleware/SAP returns an error we surface it verbatim without falling back.

**Also: expose the payload in the API response**
Add a `dmsPayload` field to each vendor result so the caller can see exactly what was sent to SAP:

```json
{
  "success": true,
  "message": "...",
  "results": [
    {
      "BP_LIFNR": "0001017573",
      "success": true,
      "message": "...",
      "attemptedCount": 4,
      "uploadedCount": 4,
      "failedCount": 0,
      "skipped": [],
      "failedDocuments": [],
      "dmsPayload": {
        "BP_LIFNR": "0001017573",
        "FILE_UPLOAD": [
          { "FILE_NAME": "gst.pdf", "FILE_PATH": "C:/Users/ADMIN/OneDrive/Desktop/...", "FILE_SIZE": 234567, "FILE": "<base64>" },
          ...
        ]
      },
      "sap": { ... },
      "sapRows": [ ... 4 rows ... ]
    }
  ]
}
```

The `FILE` (base64) is included in full — no truncation, no size cap — matching the user's requirement to "show payload also and there is not limit for payload".

### File changes (Issue 1)

- `supabase/functions/sync-vendor-to-dms/index.ts`
  - Collect all documents for a vendor into one `FILE_UPLOAD` array.
  - Replace the per-document POST loop with a **single** POST to the discovered DMS endpoint (`/sap/dms/upload`, with `/sap/bp/create` still available as legacy fallback for endpoint discovery only, not for retries).
  - Remove the `PAYLOAD_TOO_LARGE` middleware-envelope handling and the per-file retry path.
  - Remove the `estimateUploadBytes` / `formatMb` size-warning noise from the hot path (keep basic logging).
  - Interpret the returned rows: pair each `sapRow` with the file at the same index; `MSGTYP === "S"` = uploaded, otherwise recorded as a failed document.
  - Add `dmsPayload` (the exact JSON body sent to the middleware) to each item in `results`. Response keys `success`, `message`, `attemptedCount`, `uploadedCount`, `failedCount`, `sapRows`, `sap`, `skipped`, `failedDocuments` remain unchanged so existing UI keeps working.

No frontend, DB, or other function changes for Issue 1.

---

## 2) App auto-refreshes when switching tabs / minimizing

Root cause in `src/main.tsx` (production only — preview disables the SW):

```ts
window.addEventListener("focus", () => {
  navigator.serviceWorker.getRegistrations()
    .then((regs) => regs.forEach((r) => r.update()));
});

navigator.serviceWorker.addEventListener("controllerchange", () => {
  if (refreshing) return;
  refreshing = true;
  setTimeout(() => window.location.reload(), 800);
});
```

On `https://vendx.ramky.com`:
1. User switches to DevTools / Teams / another tab → returns to the app.
2. `focus` event fires → `reg.update()` runs on every SW registration.
3. If the server has a newer `sw.js`, a new SW installs and takes control.
4. `controllerchange` fires → `window.location.reload()` after 800 ms.
5. Result: page hard-reloads, open modals/popups close, unsaved form state is lost.

### File changes (Issue 2)

- `src/main.tsx`
  - Remove the `window.addEventListener("focus", ...)` block that calls `reg.update()`. Keep the initial `reg.update()` on load only.
  - Remove the automatic `window.location.reload()` inside the `controllerchange` handler.
  - Keep the existing sonner `notifyNewVersion` toast when a new SW installs, but make it actionable ("A new version is available — Refresh") so the reload only happens on explicit user click.

Effect: switching tabs / minimizing the browser no longer triggers a reload. Popups, wizard steps, and unsaved edits are preserved. Users move to a new version only when they click the toast or refresh manually.

No changes to `public/sw.js`, auth, or any other module.

---

## Deploy notes

- Issue 1: redeploy the `sync-vendor-to-dms` Edge Function after the edit.
- Issue 2: rebuild + deploy the frontend to `vendx.ramky.com`. Browsers still holding the old SW will pick up the fixed behaviour on their next reload.
