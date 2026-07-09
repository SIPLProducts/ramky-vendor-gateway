## Problem

After clicking the password reset email link, the user lands on a 404. The `/reset-password` route exists in `App.tsx`, so the underlying issue is that the current `ResetPassword` page does **not** process the auth parameters Supabase appends to the redirect URL. When the browser hits `/reset-password?code=...` (PKCE) or `/reset-password#access_token=...&type=recovery` (implicit), the component only waits passively on `onAuthStateChange`. If the redirect chain runs into an unexpected host or the code isn't exchanged, the user is dumped on a page that never becomes "ready" — and on the published custom domain (`vms.siplproducts.com`) an unhandled hash/query can be interpreted as an asset request and return 404.

The fix keeps everything client-side: make `/reset-password` actively consume whatever Supabase hands it, then render the password form. Also make the send-side always use the currently open origin so the link matches the site the user came from.

## Changes

### 1. `src/pages/ResetPassword.tsx`
On mount, before deciding to show the "open this page from the email link" message:
- Read `window.location.search` and `window.location.hash`.
- If `?code=<uuid>` is present, call `supabase.auth.exchangeCodeForSession(code)`; on success set `ready = true` and `history.replaceState` to strip the query.
- Else if hash contains `access_token` and `refresh_token` (with `type=recovery` or `type=signup`), call `supabase.auth.setSession({ access_token, refresh_token })`; on success set `ready = true` and clear the hash.
- Else if hash contains `error` / `error_description`, show that message inline instead of the generic "open from email" alert (covers expired/used links).
- Keep the existing `onAuthStateChange` + `getSession` fallback for already-authenticated recovery sessions.
- Only after all of the above resolve should the page decide whether to render the form or the info alert.

### 2. `src/components/auth/ForgotPasswordDialog.tsx`
No logic change, but guarantee the redirect target is always the current site origin plus `/reset-password` (already the case) and trim trailing slashes so the URL Supabase stores in the link is stable across preview/custom-domain.

### 3. `supabase/functions/send-password-reset/index.ts`
Pass the incoming `redirectTo` through to `generateLink` unchanged (already done), and add a `console.log` of the final `action_link` host so future 404 reports can be diagnosed from edge logs. No behavioural change to link generation.

## Technical Details

- Supabase's `admin.generateLink({ type: 'recovery' })` returns a `.../auth/v1/verify?token=...&type=recovery&redirect_to=<redirectTo>` URL. Supabase verifies then 302-redirects to `redirectTo` — with either `?code=...` (PKCE) or `#access_token=...` (implicit) depending on the project's auth flow. The current page handles neither explicitly, which is the root cause of the "opens but 404 / blank" behaviour.
- Using `exchangeCodeForSession` is safe on any route; if the code is invalid it returns an error we surface inline.
- No database or edge-function schema changes. No new routes. No styling changes beyond a small inline error message.

## Out of Scope

- Changing the SMTP sender or email template content.
- Auth provider configuration (site URL / redirect allow-list) — those are managed in the backend settings screen, not code.
