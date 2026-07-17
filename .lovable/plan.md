## Part A — Move DMS payload construction to the browser

Goal: the exact `{ BP_LIFNR, FILE_UPLOAD: [{ FILE, FILE_PATH, FILE_NAME }, …] }` sent to SAP DMS is visible under **Network → sync-vendor-to-dms → Payload** in the browser.

### Client changes — `src/hooks/useVendors.tsx` (`useDMSSync`)

For each `vendorId` passed in:

1. Load the vendor (needed for `sap_vendor_code` → `BP_LIFNR`) and its `vendor_documents` rows (`file_name`, `file_path`) via the Supabase JS client.
2. For every document, download the file from the `vendor-documents` storage bucket using `supabase.storage.from('vendor-documents').download(path)`, then base64-encode the blob in the browser (chunked `FileReader`/`Uint8Array` loop to avoid stack overflow on large files).
3. Rewrite `FILE_PATH` to the Windows DMS prefix (`C:/Users/ADMIN/OneDrive/Desktop/…`) — same rule the edge function uses today, moved to a shared helper `src/lib/dmsPath.ts`.
4. Build one payload per vendor:
   ```
   { vendorId, payload: { BP_LIFNR, FILE_UPLOAD: [{ FILE, FILE_PATH, FILE_NAME }, …] } }
   ```
5. Invoke `sync-vendor-to-dms` **once per vendor** with that body. Because the payload now sits in the invoke body, DevTools shows it in the request panel exactly as requested.
6. Aggregate the per-vendor responses into the same `{ success, message, results }` shape the callers already consume — no UI changes.

Skip/failure surface: if a document row has no `file_path` or download fails, push a `failedDocuments` entry in the client result and still send the remaining files (matches current behavior).

No changes to `MultipleSapSyncDialog` or other callers — the mutation signature `{ vendorIds: string[] }` stays the same.

### Edge function changes — `supabase/functions/sync-vendor-to-dms/index.ts`

The function already accepts `{ vendorId, payload: { BP_LIFNR, FILE_UPLOAD } }` and `{ BP_LIFNR, FILE_UPLOAD }` shapes. Keep that intact and:

- Continue to POST the batched `FILE_UPLOAD` to `/sap/dms/upload` unchanged (no size cap, no per-file fallback).
- Keep `results[].dmsPayload` in the response for parity, but the browser will already have the source of truth.
- Legacy `{ vendorIds: [...] }` requests still work (server downloads + base64), so nothing else calling the function breaks.

No DB, RLS, storage, or config changes needed — `vendor-documents` is already reachable with the user's session for the roles that can trigger DMS sync.

## Part B — Stop the "page refreshes when I switch tabs" issue

Root cause: `src/hooks/useAuth.tsx` unconditionally clears `userRole`/`customRoles` and sets `rolesLoading = true` on **every** `onAuthStateChange` event, including `TOKEN_REFRESHED` and `USER_UPDATED` which Supabase fires when the tab regains focus or on the periodic refresh interval. `ProtectedRoute` then renders a full-page loader (`if (loading || (user && rolesLoading))`), unmounting `VendorList`, `VendorReviewDialog`, and any other open popup — which looks exactly like a page refresh and drops form/dialog state.

### Fix — `src/hooks/useAuth.tsx`

- Keep a ref of the last-loaded `user.id`.
- On the auth listener:
  - `SIGNED_OUT` → clear session/user/roles as today.
  - `SIGNED_IN` / `INITIAL_SESSION` → update session/user; **only** reset roles + call `loadRoles()` when the user id actually changed from the ref (first sign-in or account switch). Otherwise leave `userRole`, `customRoles`, and `rolesLoading` untouched.
  - `TOKEN_REFRESHED` / `USER_UPDATED` / any other event → just refresh `session` and `user`; do NOT touch role state.

This keeps `ProtectedRoute` mounted across tab switches, so open dialogs and unsaved form state survive.

No changes to `ProtectedRoute`, `AppLayout`, `useIdleLogout`, react-query config, or `src/main.tsx` (SW reload path is already gone).

## Files touched

- `src/hooks/useVendors.tsx` — rewrite `useDMSSync` mutationFn to build payload in-browser.
- `src/lib/dmsPath.ts` — new small helper for `toDmsPath()` and base64 chunking.
- `src/hooks/useAuth.tsx` — gate role reloads by event type + user-id change.
- `supabase/functions/sync-vendor-to-dms/index.ts` — no functional change required; just keep the `{ vendorId, payload }` branch working.

## Out of scope

- No changes to react-query `refetchOnWindowFocus` (background refetches don't unmount the tree; the auth gate was the real cause).
- No changes to the middleware, nginx, or SAP DMS endpoint itself.
- No new storage buckets, DB tables, or RLS policies.
