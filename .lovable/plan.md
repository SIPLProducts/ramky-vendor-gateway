## Problem

The vendor invitation flow opens correctly at the public URL
`http://206.1.23.95:9009/vendor/invite?token=…`, but the "Begin Registration"
step then bounces to the internal address:

`http://10.200.1.7/auth/v1/verify?token=…&redirect_to=http://10.200.1.7`

Root cause: the self-hosted Supabase stack on the VM was first deployed with
`PUBLIC_BASE_URL=http://10.200.1.7` (the LAN IP), so GoTrue was started with:

- `SITE_URL=http://10.200.1.7`
- `API_EXTERNAL_URL=http://10.200.1.7/supabase`

GoTrue uses those values to build every magic-link / verify URL it returns
from `admin.generateLink()`. Now that the server is exposed publicly as
`http://206.1.23.95:9009`, those baked-in URLs are wrong.

The existing `accept-vendor-invite` edge function does try to fix this, but
only rewrites the path (adds `/supabase`) when the action_link host already
matches the caller's origin host — it never rewrites the host itself, so the
internal IP leaks through.

Additionally `scripts/deploy-vms-server.sh` hardcodes
`HOST_IP=10.200.1.7` as the default, which is what produced the original
misconfiguration and would do so again on the next redeploy.

## Fix (two layers, no functional change to working flows)

### 1. Defensive rewrite in `accept-vendor-invite` (edge function)

In `supabase/functions/accept-vendor-invite/index.ts`, when normalizing
`action_link`:

- Always rewrite `actionUrl.protocol`, `actionUrl.host`, and `actionUrl.port`
  to match the caller's `redirectOrigin` (the public URL the vendor is
  actually browsing on), not only when the hosts already match.
- Keep the existing logic that prefixes `/supabase` in front of
  `/auth/v1/...` so Nginx routes the verify call to Kong.
- Also rewrite the `redirect_to` query parameter inside the action link the
  same way, so after GoTrue verifies the token it sends the vendor back to
  the public origin (`/vendor/registration?token=…`), not the LAN IP.
- Preserve all other query parameters (token, type, etc.) untouched.
- If `redirectOrigin` is missing or invalid, fall back to the current
  behavior (no rewrite) so existing cloud / direct-Supabase deployments are
  unaffected.

This makes the function tolerant of any `SITE_URL` / `API_EXTERNAL_URL`
value GoTrue was started with, including the old `10.200.1.7`, without
needing to restart the stack to fix the immediate user-facing problem.

### 2. Remove hardcoded internal IP from deploy scripts

In `scripts/deploy-vms-server.sh`:

- Drop the `HOST_IP=10.200.1.7` default. Require the operator to pass
  `HOST_IP=…` or `PUBLIC_BASE_URL=…` explicitly (with a clear error message
  if neither is provided), and recommend using the public URL
  (`PUBLIC_BASE_URL=http://206.1.23.95:9009`) rather than the LAN IP.

In `scripts/selfhost/deploy-latest.sh`:

- Replace the hardcoded `curl -I http://10.200.1.7/` hint with a message
  that uses `${PUBLIC_BASE_URL}` (or just `$HOST_IP`) so the printed
  instructions match the actual deployment.

No change to `setup-selfhost.sh` (already parameterized via `--host-ip` /
`PUBLIC_BASE_URL` and auto-detected from `hostname -I`).

No change to `scripts/lib/20-supabase.sh` or `scripts/lib/60-frontend.sh`:
they already use `${PUBLIC_BASE_URL}` correctly. To make GoTrue itself
stop emitting `10.200.1.7` links permanently, the operator needs to re-run
the setup with the correct `PUBLIC_BASE_URL`:

```text
sudo PUBLIC_BASE_URL=http://206.1.23.95:9009 \
     bash setup-selfhost.sh --skip-build --skip-migrations --skip-functions
```

This rewrites `/opt/vms/supabase/.env` with the new `SITE_URL` /
`API_EXTERNAL_URL` / `SUPABASE_PUBLIC_URL` and restarts the stack. The
edge-function fix in step 1 keeps invites working even before the operator
gets a chance to do that.

## Out of scope

- No changes to the React app, registration flow, approval flow, or any
  other edge function.
- No DB schema migrations.
- No changes to Nginx config or middleware.

## Verification

1. Click an invite link at `http://206.1.23.95:9009/vendor/invite?token=…`.
2. Observe the redirect: it should now go to
   `http://206.1.23.95:9009/supabase/auth/v1/verify?token=…&redirect_to=http%3A%2F%2F206.1.23.95%3A9009%2Fvendor%2Fregistration%3Ftoken%3D…`
   — no `10.200.1.7` anywhere.
3. After GoTrue verifies, the vendor lands on
   `http://206.1.23.95:9009/vendor/registration?token=…`, signed in.
4. Existing flows on the hosted preview (`*.lovable.app`) and direct
   Supabase cloud setups continue to work, since the rewrite only kicks in
   when `redirectOrigin` is provided and differs from the action_link host.
