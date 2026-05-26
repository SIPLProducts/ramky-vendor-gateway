## Problem

Email arrives correctly. When the vendor clicks **Begin Registration** (or the Direct Link), the browser goes:

1. `http://10.200.1.7/vendor/invite?token=…` → loads `VendorInviteAccept`
2. The page calls the `accept-vendor-invite` edge function
3. That function asks GoTrue for a magic link and gets back  
   `http://10.200.1.7/auth/v1/verify?token=…&type=magiclink&redirect_to=…`
4. The browser is redirected to that URL → **nginx returns 404** (the SPA fallback hits, no React route matches `/auth/v1/verify`)

Root cause: On the self-hosted server, Supabase is reverse-proxied under **`/supabase/…`** (nginx `location /supabase/` → Kong). GoTrue’s currently-running container, however, has `API_EXTERNAL_URL=http://10.200.1.7` (no `/supabase` suffix), so the action link it mints omits the prefix. The deploy script already writes the correct value to `.env`, but the running `auth` container was started before that change and hasn’t been restarted with the new env. On Lovable Cloud the same code works because the Supabase host has no path prefix.

We can’t rely on the user always remembering to restart GoTrue with the right env, and we shouldn’t break the cloud preview either. The robust fix is to make `accept-vendor-invite` normalize the returned `action_link` so it always points through the public proxy.

## Fix

Single change, single file: **`supabase/functions/accept-vendor-invite/index.ts`**

After `admin.auth.admin.generateLink(...)` succeeds, post-process `linkData.properties.action_link`:

```ts
const rawActionLink = linkData.properties.action_link as string;
let actionLink = rawActionLink;

try {
  const actionUrl = new URL(rawActionLink);
  const originUrl = redirectOrigin ? new URL(redirectOrigin) : null;

  // Self-hosted: Supabase lives behind nginx at <origin>/supabase/.
  // GoTrue may have been started with API_EXTERNAL_URL pointing at the
  // bare origin, producing /auth/v1/verify (404 in the SPA). If the link
  // host matches the frontend host and the path starts with /auth/v1/,
  // inject the /supabase prefix so it routes through Kong.
  if (
    originUrl &&
    actionUrl.host === originUrl.host &&
    actionUrl.pathname.startsWith("/auth/v1/") &&
    !actionUrl.pathname.startsWith("/supabase/")
  ) {
    actionUrl.pathname = "/supabase" + actionUrl.pathname;
    actionLink = actionUrl.toString();
  }
} catch (e) {
  console.warn("action_link normalization failed:", e);
}

return new Response(
  JSON.stringify({ action_link: actionLink, email, invitation_id: invite.id }),
  { status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" } }
);
```

That is the only logic change — everything else (token validation, user provisioning, magic-link generation, redirect target) stays identical.

### Why this is safe on Lovable Cloud

- On Lovable Cloud the action link host is `kntaaugefxhymmrvivaj.supabase.co`, which never matches the frontend origin (`*.lovable.app` / `vms.siplproducts.com`), so the `if` branch is skipped and the link is returned unchanged.
- Only the self-hosted case (same host, bare `/auth/v1/…`) gets the `/supabase` prefix injected.

## Verification

1. Redeploy `accept-vendor-invite` (Lovable Cloud auto-deploys; on-prem needs the usual `git pull` + `rsync supabase/functions/accept-vendor-invite/` + `docker compose restart functions`).
2. Send a fresh invitation, click **Begin Registration** in the email.
3. Browser should redirect to `http://10.200.1.7/supabase/auth/v1/verify?…`, GoTrue exchanges the magic token, then bounces back to `http://10.200.1.7/vendor/registration?token=…` signed in.
4. No 404, registration form loads.

## Out of scope

- No frontend changes.
- No DB/migration/secret changes.
- No change to the SMTP fix already shipped.
- We are not touching the on-prem GoTrue env; the normalizer makes the system self-correcting, but the user can still optionally restart `auth` with the updated `API_EXTERNAL_URL` for a cleaner setup.
