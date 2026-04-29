I found the cause of the repeated error:

The SAP Sync button is still invoking the `sync-vendor-to-sap` backend function, and that function only checks runtime secrets named `SAP_MIDDLEWARE_URL` and `SAP_MIDDLEWARE_KEY`. Those secrets are not currently configured. Because `SAP_MIDDLEWARE_URL` is missing, the function falls back to the direct SAP URL `http://10.200.1.2:8000/...`, which Lovable Cloud cannot reach, causing:

```text
Could not reach SAP: The signal has been aborted
```

The middleware also printed:

```text
MIDDLEWARE_SHARED_SECRET is not set
SAP target: (not configured)
```

so the local `middleware/.env` setup is also incomplete.

## Plan to fix

1. Update `sync-vendor-to-sap` so it no longer depends only on hidden runtime secrets.
   - It will read the active Business Partner SAP API configuration from the app database (`sap_api_configs` + `sap_api_credentials`).
   - If the config is set to `connection_mode = proxy` and has `middleware_url`, it will call:
     ```text
     {middleware_url}/sap/bp/create
     ```
   - It will send the configured `proxy_secret` as `x-middleware-key`.
   - It will only fall back to the direct SAP URL when the saved config is explicitly set to direct mode.

2. Improve failure messages in `sync-vendor-to-sap`.
   - If no middleware URL is configured, return a clear setup error instead of silently trying the private IP.
   - If the middleware returns `401`, show that the proxy secret does not match `MIDDLEWARE_SHARED_SECRET`.
   - If the middleware returns `500` for missing SAP env vars, show that the middleware `.env` is incomplete.
   - If SAP times out behind the middleware, show that the middleware can be reached but SAP is unreachable from that machine.

3. Fix middleware usability.
   - Add a friendly `GET /` response instead of `404`, pointing to `/health` and available endpoints.
   - Keep `/health` as the quick test URL.
   - Keep `/sap/bp/create` as the sync endpoint.

4. Fix SAP Connectivity Guide text.
   - It currently says `POST /proxy`, but the implemented endpoint is `/sap/bp/create` for vendor sync and `/sap/proxy` for generic proxying.
   - Update the instructions so the user stores only the base middleware URL, for example:
     ```text
     https://abc123.ngrok-free.app
     ```
     not `/sap/bp/create`.

5. Add or update the app-side configuration behavior.
   - On the SAP API Settings page, the saved `Node.js Middleware URL` and `Proxy Secret / Password` will become the source of truth for the SAP Sync button.
   - This avoids needing manual Lovable Cloud secret setup for every middleware URL change, especially when using ngrok URLs that change often.

## Required local middleware setup after code fix

On your Windows machine in:

```text
D:\VPCL_Ramky\ramky-vendor-gateway\middleware
```

you still need a real `.env` file, copied from `.env.example`, with these values filled:

```text
PORT=3002
MIDDLEWARE_SHARED_SECRET=<same value saved in SAP API Settings as Proxy Secret / Password>
SAP_BP_API_URL=http://10.200.1.2:8000/vendor/bp/create?sap-client=300
SAP_BP_USERNAME=22000208
SAP_BP_PASSWORD=Nani@1432
SAP_REQUEST_TIMEOUT_MS=30000
CORS_ORIGINS=*
ALLOW_INSECURE_TLS=0
```

Then restart:

```text
node server.js
```

Expected startup should become:

```text
Sharvi SAP middleware listening on :3002
SAP target: 10.200.1.2:8000
```

## Expected result

After approval and implementation:

```text
SAP Sync button
  -> sync-vendor-to-sap function
  -> saved middleware URL
  -> local middleware /sap/bp/create
  -> SAP private API
```

The app will stop falling back to the private SAP IP from Lovable Cloud, and if setup is still incomplete it will show a precise message telling whether the missing piece is the app config, proxy secret, middleware `.env`, or SAP network reachability.