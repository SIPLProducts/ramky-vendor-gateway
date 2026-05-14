## Diagnosis

The timeout is happening inside the on-prem Node middleware, not in the browser or Lovable Cloud request itself.

The key clue is:

```text
ConnectTimeoutError [UND_ERR_CONNECT_TIMEOUT]
FAILED after 10020ms GET http://10.200.1.2:8000/...
```

Node 18+ `fetch` uses Undici internally. Undici has its own default TCP connect timeout of about 10 seconds. Your `SAP_REQUEST_TIMEOUT_MS=30000` AbortController controls the total request, but it does not override Undici’s lower-level connect timeout. That is why Postman can succeed while Node fails at around 10 seconds.

## Plan

1. **Update middleware HTTP client timeout behavior**
   - Add Undici `Agent` / `setGlobalDispatcher` configuration in `middleware/server.js`.
   - Set the connection timeout from env, e.g. `SAP_CONNECT_TIMEOUT_MS`, defaulting to a higher value like 60000ms.
   - Keep `SAP_REQUEST_TIMEOUT_MS` as the total request timeout.

2. **Improve SAP diagnostics in middleware**
   - Make timeout errors explicit: distinguish `UND_ERR_CONNECT_TIMEOUT`, AbortController timeout, DNS/network errors, and SAP HTTP errors.
   - Include configured timeout values in the `/health` response so you can confirm the running service picked up the right settings.
   - Keep secrets redacted.

3. **Align environment examples and docs**
   - Add `SAP_CONNECT_TIMEOUT_MS=60000` to `middleware/.env.example`.
   - Update `middleware/README.md` troubleshooting so this exact Postman-vs-Node timeout case is documented.

4. **Optional safety in the F4 edge function**
   - The edge function currently waits up to 25 seconds for middleware. If middleware is allowed to take 60 seconds, the F4 refresh can still fail early from Lovable Cloud.
   - For the F4 master-data refresh, either:
     - keep middleware connect timeout at 20–25 seconds for this path, or
     - raise the edge function wait time carefully if platform limits allow it.
   - I recommend setting middleware connect timeout to **20000ms** for F4 first, and only increasing if SAP truly needs longer to establish TCP connections.

## Expected result

- Node middleware will no longer fail at the hard 10-second Undici connect timeout.
- If SAP still cannot be reached from that Windows server, the error will clearly say whether it is a network/firewall/connectivity issue versus an app timeout.
- F4 refresh will continue showing only real SAP-loaded options, without fallback/unfiltered data.