## Problem

On the self-hosted server, clicking the invite link shows the generic "Unable to open invitation" screen. The client swallows the real reason (edge function error/code), and self-hosted logs aren't accessible from here, so we can't diagnose. We need the UI to show the actual failure reason and make the claim call more resilient.

## Plan

### 1. Surface the real error in the UI (`src/pages/VendorInviteAccept.tsx`)
- When the edge function returns any non-success `status`/`code` (e.g. `lookup_failed`, `provision_failed`, `signin_failed`, `claim_failed`, `unknown`, `method_not_allowed`), display that `code` and any `message`/`error` string inline on the error card, plus the HTTP status.
- If `supabase.functions.invoke` throws (network/CORS/500 with no JSON body), read `error.message`, `error.context?.status`, and try `error.context?.response?.text()` — show whichever is available.
- Add a small "Retry" button and a "Copy details" button so vendor/support can send us the exact failure text.

### 2. Make the claim call more robust (`supabase/functions/claim-vendor-invite/index.ts`)
- Wrap the `admin.auth.admin.listUsers({ perPage: 200 })` call with pagination (loop pages) so invited emails past the first 200 users are still found — this is a common self-hosted failure mode after many users exist.
- On `signInWithPassword` failure, retry once after force-updating the password (covers cases where a stale password hash exists on the auth user from an earlier run).
- Always return `message` alongside `code` in the JSON body (never just `code`), so the client can display it.
- Add `console.log` breadcrumbs at each step (`lookup ok`, `user resolved`, `claim stamped`, `signin ok`) so self-hosted logs are useful when we do get access.

### 3. Quick self-check tool (no schema change)
- Add a dev-only "Diagnostics" link on the error screen that calls a new `GET` endpoint on the same function returning `{ ok: true, env_ok: <bool> }` (checks `SUPABASE_URL`, `SUPABASE_SERVICE_ROLE_KEY`, `SUPABASE_ANON_KEY` presence) — helps confirm the edge function is actually deployed and env is set on the self-hosted server.

## What this unblocks

Next time you click the failing invite link, the screen will show the exact failure (e.g. `signin_failed: Invalid login credentials`, or `provision_failed: <message>`, or the raw HTTP status if the function isn't reachable). Share that text back and I can fix the root cause in one pass instead of guessing.

## Files touched

- `src/pages/VendorInviteAccept.tsx` — richer error display + retry/copy
- `supabase/functions/claim-vendor-invite/index.ts` — paginated user lookup, sign-in retry, always-include `message`, breadcrumbs, GET diagnostics
