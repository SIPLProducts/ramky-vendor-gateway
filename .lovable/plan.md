# Fix: Edge Function can't reach middleware at public IP from inside Docker

## What the log shows
- `middleware_url_normalized: "http://206.1.23.95:9009"` — the DB still has the public IP
- Fetch hits `in-code-timeout` after 25s
- You already confirmed: from inside the functions container, `http://172.17.0.1:9009` works in ~17ms, but `http://206.1.23.95:9009` times out (NAT hairpin blocked)

The rewrite I added only catches `127.0.0.1` / `localhost`. The DB value is the public IP, so the rewrite never fires and the function tries the unreachable address.

## Fix (two layers, both needed)

### 1. Set `SAP_MIDDLEWARE_URL_OVERRIDE` secret = `http://172.17.0.1:9009`
The shared normalizer already honors this env var above the DB value. Once set, every SAP edge function (`fetch-tenants-from-sap`, `sap-api-test-connection`, `sap-master-fetch`, `sync-vendor-to-sap`, `sync-vendor-to-dms`, `sync-vendors-to-sap-bulk`) will route through the Docker gateway regardless of what's in `sap_api_configs.middleware_url`. This is the immediate unblocker — no code change, no redeploy.

I'll prompt for this via the add_secret tool after you approve.

### 2. Extend `rewriteContainerHost()` to also rewrite the known public IP
Belt-and-suspenders so a future operator who clears the override or edits the DB doesn't re-break it. In all 6 functions' `rewriteContainerHost`:

- Add an extra env-driven list `SAP_MIDDLEWARE_HOST_REWRITES` (comma-separated `from=to` pairs, e.g. `206.1.23.95=172.17.0.1`).
- If the URL's hostname matches a `from`, rewrite to `to` and log `middleware.url.rewritten` with the mapping source (`env-override` | `loopback` | `host-rewrite-list`).
- Keep the existing `127.0.0.1` / `localhost` → `172.17.0.1` behavior unchanged.

### 3. No other changes
- No timeout changes (already clamped to 25s, which is correct for the Edge wall-clock).
- No business logic, payload, auth, schema, or frontend changes.
- No queue/background-worker refactor — middleware responds in ~17ms once the host is reachable, so the existing synchronous path is fine.

## After implementation
1. I add `SAP_MIDDLEWARE_URL_OVERRIDE=http://172.17.0.1:9009` (with your confirmation).
2. I write the `rewriteContainerHost` extension to all 6 edge functions; Lovable auto-commits and pushes to GitHub.
3. Edge Functions redeploy automatically.
4. Retry "Fetch tenants" from the app and confirm the new log line: `middleware.url.override` (or `middleware.url.rewritten` with `source: "host-rewrite-list"`) → `proxy.fetch.start` → `proxy.fetch.end` (status 200) → `sap.parsed` → `response.sent`.

Approve to switch to build mode and apply.
