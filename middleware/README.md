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
SAP_BP_USERNAME=22000208
SAP_BP_PASSWORD=Nani@1432
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

## Redeploy after body-limit / DMS changes

If you see `HTTP 413 PayloadTooLargeError` from `/sap/dms/upload`, the running middleware is using an older body limit. The current default is **200 MB**. Redeploy:

1. Stop the Windows service (or the `node server.js` process).
2. Replace `server.js` (and `package.json` if changed) with the latest from this repo in `D:\middleware (2)\middleware`.
3. Run `npm install` in the middleware folder.
4. Restart the service (`node server.js`).
5. Verify the active limit:
   ```
   curl http://localhost:3002/health
   ```
   The response should include `"bodyLimit": "200mb"`. The startup log should also print `Body limit: 200mb`.
6. Re-run the DMS upload from the portal.

Optional: override with `MIDDLEWARE_BODY_LIMIT=500mb` in `.env` for very large document batches. Oversized requests now return JSON (with the active `bodyLimit`) instead of the HTML 413 page, so the portal surfaces a clear error.


## Repeated 413 "request entity too large" fix

If you keep seeing `PayloadTooLargeError: request entity too large` on Windows, it means an **old `server.js` is still running**. The new build prints a version banner on startup — if you don't see it, you're running the old file.

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
   Middleware build: dms-large-upload-v3
   Body limit: 500mb (override with MIDDLEWARE_BODY_LIMIT in .env)
   ```
6. Verify from another terminal:
   ```powershell
   curl http://localhost:3002/health
   ```
   The JSON response must include `"middlewareVersion": "dms-large-upload-v3"` and `"bodyLimit": "500mb"` (or your override).

If the banner or `/health` fields are missing, Windows is still running an older `server.js` from a different folder or a stale `node` process — repeat step 1.
