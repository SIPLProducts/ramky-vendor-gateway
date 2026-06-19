## Fix: edge function aborts before SAP responds

### Root cause
`supabase/functions/fetch-tenants-from-sap/index.ts` aborts its `fetch` to the middleware after 25s. SAP takes ~35s, so the abort fires first and the user sees `"Could not reach SAP: The signal has been aborted"`.

### Code change (1 file)
**`supabase/functions/fetch-tenants-from-sap/index.ts`** (around line 133)

Replace:
```ts
const controller = new AbortController();
const timer = setTimeout(() => controller.abort(), 25000);
```

With:
```ts
const controller = new AbortController();
// Honor per-config timeout_ms (min 90s). SAP can take ~35s; 25s caused
// "The signal has been aborted". Keep >= middleware SAP_REQUEST_TIMEOUT_MS.
const abortMs = Math.max(Number(config.timeout_ms) || 0, 90000);
const timer = setTimeout(() => controller.abort(), abortMs);
```

This makes the timeout 90s by default and lets you raise it further from the SAP API Settings UI (Timeout field) without another code change.

### Server-side changes you must apply manually
These live on your self-hosted VM, not in this repo:

1. **`middleware/.env`** on the server — raise SAP request timeout above SAP's 35s:
   ```
   SAP_REQUEST_TIMEOUT_MS=90000
   ```
   Then:
   ```
   systemctl restart vms-middleware
   ```

2. **SAP API Settings → Tenants From SAP → Timeout (ms)**: set to `90000` for consistency across functions.

3. Nginx is already fine (`proxy_read_timeout 120s` on `/sap`, `600s` on `/supabase/`). No change needed.

### Verification after deploy
```bash
# Should now return the tenants JSON in ~35s instead of aborting at 25s
time curl -s -X POST \
  http://206.1.23.95:9009/supabase/functions/v1/fetch-tenants-from-sap \
  -H "Authorization: Bearer <USER_JWT>" \
  -H "Content-Type: application/json" \
  -d '{"email":"shaileshvitthal.gundu@ramky.com"}'
```
Middleware logs (`journalctl -u vms-middleware -f`) should show:
```
[forwardToSap] <- 200 in ~35000ms (http://10.200.1.2:8000/vendor/bp/create?sap-client=300)
```

### Not doing (and why)
- **No queue/background-worker refactor.** Hosted Supabase edge functions cap at 25s wall-clock, but **self-hosted edge-runtime has no such 25s cap** — your function is running under your own nginx + Kong + edge-runtime where `proxy_read_timeout` is already 600s. The 25s limit here is purely the `setTimeout` inside the function itself. Raising it is the correct fix; a queue would add complexity for no benefit on your self-hosted setup.
- **No middleware code changes.** The middleware already forwards correctly and has 60s connect / 60s headers timeouts; only the `.env` value for `SAP_REQUEST_TIMEOUT_MS` needs raising.