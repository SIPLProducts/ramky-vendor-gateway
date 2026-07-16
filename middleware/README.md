# Sharvi Vendor Portal — SAP Middleware

A small Node.js (Express) service that the Sharvi Vendor Portal Edge Functions call instead of talking to SAP directly.

## Why it exists

The Sharvi Vendor Portal runs in Lovable Cloud (public internet). The SAP S/4HANA Business Partner API lives on a **private network** (e.g. `http://10.200.1.2:8000/vendor/bp/create`). Public functions cannot reach private IPs — so we host this middleware **inside the same network as SAP** and expose it over HTTPS to the Edge Function.

```text
Browser ──► Edge Function (sync-vendor-to-sap)  [Lovable Cloud, public]
                │  HTTPS + x-middleware-key
                ▼
        Sharvi SAP Middleware                    [this service, on-prem]
                │  HTTP + Basic Auth
                ▼
        SAP S/4HANA  10.200.1.2:8000             [internal network]
```

SAP credentials never leave your network.

## What it exposes

| Method | Path              | Purpose                                                                 |
|--------|-------------------|-------------------------------------------------------------------------|
| GET    | `/health`         | Liveness probe. No auth required.                                       |
| POST   | `/sap/bp/create`  | Forwards the JSON array to SAP Business Partner Create. Returns verbatim.|
| POST   | `/sap/dms/upload` | Forwards one SAP DMS document upload payload. Returns SAP response.      |
| POST   | `/sap/proxy`      | Generic forwarder for future SAP endpoints. Body: `{ url, method, headers, body, useBasicAuth }`. Target host must match the configured SAP host. |

All non-health endpoints require header:

```
x-middleware-key: <MIDDLEWARE_SHARED_SECRET>
```

## Configuration

Copy `.env.example` to `.env` and fill in:

```
PORT=3002
MIDDLEWARE_SHARED_SECRET=<long-random-string>      # must match SAP_MIDDLEWARE_KEY in Lovable Cloud
SAP_BP_API_URL=http://10.200.1.2:8000/vendor/bp/create?sap-client=300
SAP_DMS_API_URL=http://10.200.1.2:8000/vendor/bp/create?sap-client=300
SAP_BP_USERNAME=<sap-username>
SAP_BP_PASSWORD=<sap-password>
SAP_REQUEST_TIMEOUT_MS=30000
CORS_ORIGINS=*
ALLOW_INSECURE_TLS=0    # set to 1 only if SAP uses a self-signed cert
```

## Run locally (Node 18+)

```bash
cd middleware
cp .env.example .env       # edit values
npm install
npm start
# open http://localhost:3002/health
```

## Run with Docker

```bash
docker build -t sharvi-sap-middleware ./middleware
docker run -d --name sharvi-sap-middleware \
  --env-file ./middleware/.env \
  -p 3002:3002 \
  sharvi-sap-middleware
```

## Expose it to Lovable Cloud

The Edge Function needs an HTTPS URL it can reach. Common options:

1. **Reverse proxy** (recommended): nginx / Caddy / Traefik in front of port 3002 with a real TLS certificate.
2. **ngrok / Cloudflare Tunnel** for testing:
   ```bash
   ngrok http 3002
   ```
   Use the resulting `https://...ngrok-free.app` URL.

Then in **Lovable Cloud → Connectors → Lovable Cloud → Secrets** set:

- `SAP_MIDDLEWARE_URL` — e.g. `https://sap-proxy.your-domain.com`
- `SAP_MIDDLEWARE_KEY` — the same value as `MIDDLEWARE_SHARED_SECRET`

The `sync-vendor-to-sap` Edge Function automatically routes through the middleware whenever `SAP_MIDDLEWARE_URL` is set, and falls back to the legacy direct call otherwise.

## Quick test

```bash
curl -s http://localhost:3002/health

curl -s -X POST http://localhost:3002/sap/bp/create \
  -H 'Content-Type: application/json' \
  -H "x-middleware-key: $MIDDLEWARE_SHARED_SECRET" \
  -d '[{"bpartner":"","name1":"Test Vendor","country":"IN"}]'
```

## Troubleshooting

- **401 Unauthorized** → `x-middleware-key` header missing or doesn't match `MIDDLEWARE_SHARED_SECRET`.
- **502 + "SAP request timed out"** → SAP host unreachable from the middleware machine. Check firewall / VPN.
- **502 + `UND_ERR_CONNECT_TIMEOUT` (works in Postman, fails here)** → Node's built-in fetch (undici) has a hard 10s TCP connect timeout by default. This middleware overrides it via `SAP_CONNECT_TIMEOUT_MS` (default 60000). If you still see it, the middleware host genuinely cannot reach the SAP host:port — Postman likely runs from a different machine/network. Verify with `Test-NetConnection 10.200.1.2 -Port 8000` (PowerShell) or `curl -v http://10.200.1.2:8000/...` from the same Windows server. Check firewall, VPN split-tunnel, and any HTTP proxy.
- **TLS errors against SAP** → set `ALLOW_INSECURE_TLS=1` (only if SAP uses a self-signed cert).
- **403 from `/sap/proxy`** → target URL host doesn't match `SAP_BP_API_URL` host.

## Redeploy after DMS upload-path changes

The portal sends only vendor IDs to `sync-vendor-to-dms`; the function downloads documents server-side and forwards each document to this middleware sequentially. This avoids browser-to-function giant base64 payloads and removes any app-level total upload cap.

If you see `HTTP 413 PayloadTooLargeError` from `/sap/dms/upload`, first identify which hop returned it:
- middleware JSON response with `middlewareVersion` → middleware parser received a payload larger than a configured `MIDDLEWARE_BODY_LIMIT`.
- nginx HTML response → nginx rejected the request before middleware/SAP handled it.
- SAP response/body → SAP-side proxy or SAP rejected the individual document upload.

Redeploy the current middleware build:

1. Stop the Windows service (or the `node server.js` process).
2. Replace `server.js` (and `package.json` if changed) with the latest from this repo in `D:\middleware (2)\middleware`.
3. Run `npm install` in the middleware folder.
4. Restart the service (`node server.js`).
5. Verify the active limit:
   ```
   curl http://localhost:3002/health
   ```
   The response should include `"middlewareVersion": "dms-sequential-upload-v5"` and `"bodyLimit": "unbounded"` unless you intentionally configured `MIDDLEWARE_BODY_LIMIT`.
6. Re-run the DMS upload from the portal.

Optional: set `MIDDLEWARE_BODY_LIMIT` in `.env` only if you intentionally want a parser cap. Leaving it unset keeps the middleware parser unbounded; nginx and SAP can still enforce their own limits.


## Repeated 413 "request entity too large" fix

If you keep seeing `PayloadTooLargeError: request entity too large` on Windows, it means an **old `server.js` is still running**. The new build prints a version banner on startup — if you don't see it, you're running the old file.

The browser DevTools payload for `sync-vendor-to-dms` should now show only `{ "vendorIds": [...] }`. If it still shows `{ "BP_LIFNR": "...", "FILE_UPLOAD": [...] }`, the frontend is stale and must be redeployed. The Edge Function forwards each document to this middleware on `POST /sap/dms/upload`, which calls SAP and returns SAP's response verbatim under `sapResponse`.

If the middleware returns `Cannot POST /sap/dms/upload` (HTML 404), the running `server.js` is OLD. Restart with the latest file — the new build returns a JSON 404 listing `availableEndpoints` and includes `middlewareVersion` in the response, and `/health` lists `POST /sap/dms/upload` under `availableEndpoints`.

### Steps (run in PowerShell as Administrator)

1. Stop every Node process on port 3002:
   ```powershell
   Get-NetTCPConnection -LocalPort 3002 -ErrorAction SilentlyContinue | ForEach-Object { Stop-Process -Id $_.OwningProcess -Force }
   ```
2. Confirm you're in the right folder:
   ```powershell
   cd "D:\middleware (2)\middleware"
   ```
3. Copy the new `server.js` here (overwrite the existing one).
4. (Optional) In `.env`, set a higher limit if you upload very large bundles:
   ```
   MIDDLEWARE_BODY_LIMIT=1gb
   ```
5. Start fresh:
   ```powershell
   node server.js
   ```
   You **must** see:
   ```
   Middleware build: dms-sequential-upload-v5
   Body limit: unbounded (set MIDDLEWARE_BODY_LIMIT only if you intentionally want a parser cap)
   ```
6. Verify from another terminal:
   ```powershell
   curl http://localhost:3002/health
   ```
   The JSON response must include `"middlewareVersion": "dms-sequential-upload-v5"` and `"bodyLimit": "unbounded"` (or your intentional override).
7. Confirm the DMS endpoint accepts the SAP payload shape:
   ```powershell
   curl -Method POST http://localhost:3002/sap/dms/upload `
     -Headers @{ "Content-Type" = "application/json"; "x-middleware-key" = $env:MIDDLEWARE_SHARED_SECRET } `
     -Body '{"BP_LIFNR":"1061301","FILE_UPLOAD":[{"FILE":"BASE64","FILE_PATH":"PATH1"}]}'
   ```

If the banner or `/health` fields are missing, Windows is still running an older `server.js` from a different folder or a stale `node` process — repeat step 1.
