# Fix: 502 Bad Gateway on `POST /sap/proxy` (F4 sync)

## What the 502 actually means

The 502 is returned by **your middleware** (`middleware/server.js`, `/sap/proxy` route). Looking at the code, the only path that returns 502 is:

```js
} catch (err) {
  console.error("[proxy] error:", err);
  return res.status(502).json({ ok:false, error: ... });
}
```

That `catch` only fires when `forwardToSap()` throws — i.e. the middleware machine itself **could not complete the HTTP request to `http://10.200.1.2:8000/...`**. It is not a Lovable / edge-function problem. The edge function correctly forwarded through ngrok; the middleware accepted it (auth passed, otherwise you'd see 401), then failed to talk to SAP.

Common causes, in order of likelihood:
1. SAP host `10.200.1.2:8000` is not reachable from the machine running the middleware right now (VPN dropped, SAP server down, firewall, port blocked).
2. SAP refuses a `GET` on `/vendor/bp/create?sap-client=300` (only `POST` works), and SAP closes the socket → fetch throws.
3. SSL / TLS handshake error if the URL is `https://...` and the cert is self-signed (needs `ALLOW_INSECURE_TLS=1`).
4. 25s timeout — SAP took too long and `AbortController` aborted; fetch throws.

## Step 1 — Verify reachability from the middleware machine

On the Windows / Linux box where the middleware is running, run:

```
curl -v -u <SAP_USER>:<SAP_PASS> "http://10.200.1.2:8000/vendor/bp/create?sap-client=300"
```

- If this fails with `Connection refused` / `timeout` → networking/VPN issue, fix that first.
- If it returns `405 Method Not Allowed` or similar → the F4 endpoint does not accept GET; you must use a different SAP URL or method for F4.
- If it returns the F4 JSON → the network is fine; the issue is inside the middleware. Continue to Step 2.

## Step 2 — Make middleware errors visible

The middleware currently swallows the real cause behind a generic `502`. Improve `/sap/proxy` so the response includes the actual fetch error name + cause, and so the middleware logs the SAP target URL for every request. Concretely, in `middleware/server.js`:

- In the `catch` of `/sap/proxy`, include `err.cause?.code` and `err.name` in the JSON body and log full stack.
- In `forwardToSap`, log `url`, `method`, and `Date.now() - startedAt` even on failure.

After redeploying middleware, retry the sync and read the new error body — it will say e.g. `ECONNREFUSED`, `ETIMEDOUT`, `ENOTFOUND`, `CERT_HAS_EXPIRED`, `AbortError`, etc.

## Step 3 — Apply the targeted fix based on the real error

| Real error | Fix |
|---|---|
| `ECONNREFUSED` / `ETIMEDOUT` / `ENOTFOUND` | Network/VPN/firewall — open port 8000 from middleware host to `10.200.1.2`, or fix DNS / VPN. |
| `405` (after Step 1 curl) | F4 cannot use `bp/create`. Update the **SAP Fields F4** config in *SAP API Settings* with the correct SAP F4 endpoint and HTTP method. |
| `self signed certificate` / TLS error | Set env `ALLOW_INSECURE_TLS=1` on the middleware and restart. |
| `AbortError` | SAP is slow — bump `SAP_REQUEST_TIMEOUT_MS` (e.g. `60000`) on the middleware. |
| `403` from middleware (not 502) | `SAP_BP_API_URL` host on the middleware doesn't match `10.200.1.2:8000`. Update the env to the same host. |

## Step 4 — Surface the middleware error in the UI

Right now the SAP Sync popup just shows "Could not reach SAP via middleware". Update `sap-master-fetch` so when `wrapper.error` includes an error code (after Step 2), it is shown in the toast / dialog so the next time something breaks the user sees `ECONNREFUSED 10.200.1.2:8000` directly instead of a generic 502.

## Files that will change (after you approve)

- `middleware/server.js` — richer error body + logging on `/sap/proxy` and `forwardToSap`.
- `supabase/functions/sap-master-fetch/index.ts` — pass through middleware's structured error so UI shows the real cause.
- `src/components/sap/SapFieldsDialog.tsx` (or its sync hook) — display the detailed message.

No business-logic changes; only diagnostics + the env/network fix on your side.

## What I need from you

After Step 1 (the `curl` from the middleware host), tell me what it returned. That single result decides whether the fix is on the network side, the SAP-endpoint side, or the middleware code side.
