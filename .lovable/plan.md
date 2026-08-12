# Fix DEV Tenant Fetch Worker Boot Failure

## Confirmed cause

`fetch-tenants-from-sap` cannot start because `supabase/functions/fetch-tenants-from-sap/index.ts` has an extra closing brace immediately before the `else` at line 302. The runtime rejects the file while building its module graph, so the request never reaches Nginx middleware routing or SAP.

The current error is therefore unrelated to the API credentials, SAP Base URL, proxy secret, or DEV port reachability. Those can only be tested after the function boots.

## Changes

1. Correct the malformed `if (!res.ok) { ... } else { ... }` block in `fetch-tenants-from-sap` without changing its intended response handling.
2. Keep the detailed timeout, connection, secret-mismatch, and attempted-URL diagnostics already present in the function.
3. Add a deployment-time syntax/type validation for edge-function entrypoints so a malformed function is stopped before the DEV functions container is recreated.
4. Update the self-host deployment diagnostics to explicitly verify `fetch-tenants-from-sap/index.ts` is present and report its worker boot errors.

## DEV routing decision

Use one of these routes, not both:

```text
Recommended existing route
Edge function -> http://10.200.1.7/sap/proxy -> Nginx :80 -> Node middleware :3002
```

With the API setting shown (`Node.js Middleware URL = http://10.200.1.7`), the main DEV Nginx `location ~ ^/(sap|health)` already forwards `/sap/proxy` to port `3002`. The separate Nginx server listening on `9008` is not required for this route and may be removed after confirming nothing else uses it.

If port `9008` is retained instead, the saved middleware URL must explicitly be `http://10.200.1.7:9008`; the separate “Middleware Port” field is currently not used by this function to construct the URL.

Node.js itself should continue listening on `3002`. It should not bind directly to `10.200.1.7`; Nginx owns the externally reachable host/port and proxies to Node on localhost.

## Deploy and verify on DEV

1. Sync the corrected function to the DEV functions volume and recreate only the DEV functions container.
2. Confirm the worker boots without `InvalidWorkerCreation`.
3. Call the function again with an authenticated request.
4. Confirm `/sap/proxy` appears in DEV middleware logs and the response is either the tenant list or a specific connectivity/configuration error.
5. Leave PROD unchanged because it is already working.
