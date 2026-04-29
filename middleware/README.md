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
- **TLS errors against SAP** → set `ALLOW_INSECURE_TLS=1` (only if SAP uses a self-signed cert).
- **403 from `/sap/proxy`** → target URL host doesn't match `SAP_BP_API_URL` host.
