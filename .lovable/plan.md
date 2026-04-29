## Goal

The SAP Business Partner API (`http://10.200.1.2:8000/...`) lives on a **private network** and cannot be reached directly from Lovable Cloud Edge Functions (which run on the public internet). We'll add a small **middleware service** the customer hosts inside their own network. It receives requests from the Edge Function over HTTPS, forwards them to SAP, and returns SAP's response unchanged.

```text
Browser ──► Edge Function (sync-vendor-to-sap)
                │  HTTPS + shared secret
                ▼
        Middleware (Node.js / Express)   ← runs inside Ramky network
                │  HTTP + Basic Auth
                ▼
        SAP S/4HANA  10.200.1.2:8000
```

## What we'll add

### 1. `middleware/` folder in the repo (not deployed by Lovable — for the customer to host)

Files:

- `middleware/package.json` — Express, node-fetch, dotenv, helmet, morgan.
- `middleware/server.js` — the proxy.
- `middleware/.env.example` — template for SAP creds + shared secret.
- `middleware/Dockerfile` — so it can be deployed to any Docker host inside the Ramky network.
- `middleware/README.md` — install / run / deploy / troubleshooting instructions.

### 2. Endpoints exposed by the middleware

| Method | Path | Purpose |
|---|---|---|
| `GET`  | `/health` | Liveness check (returns `{ ok: true }`) |
| `POST` | `/sap/bp/create` | Forwards JSON body to SAP `vendor/bp/create`, returns SAP JSON unchanged |
| `POST` | `/sap/proxy` | Generic forwarder (body: `{ url, method, headers, body }`) for future SAP APIs |

Middleware behavior:

- Requires header `x-middleware-key: <MIDDLEWARE_SHARED_SECRET>` on every non-health request. Rejects with 401 otherwise.
- Reads `SAP_BP_API_URL`, `SAP_BP_USERNAME`, `SAP_BP_PASSWORD` from its own `.env` (so the SAP password never leaves Ramky's network).
- Adds `Authorization: Basic base64(user:pass)` and forwards body as-is.
- 30s timeout, logs request/response (with password redacted), returns SAP status + body verbatim.
- CORS locked down (only allows the Edge Function host + localhost for testing).
- Self-signed TLS support (so the Edge Function can call `https://...` directly), or it can sit behind nginx/Caddy.

### 3. Update the Edge Function `sync-vendor-to-sap`

- Add 2 new optional secrets: `SAP_MIDDLEWARE_URL` and `SAP_MIDDLEWARE_KEY`.
- If `SAP_MIDDLEWARE_URL` is set, the function POSTs the existing payload to `${SAP_MIDDLEWARE_URL}/sap/bp/create` with header `x-middleware-key` instead of calling SAP directly.
- If not set, falls back to today's behavior (direct call to `SAP_BP_API_URL`) — so nothing breaks until the middleware is deployed.
- Response parsing stays identical (still expects the SAP JSON array with `MSGTYP` / `BP_LIFNR`).

### 4. Tiny UI hint on **SAP API Settings** screen

Add a one-line note in the existing `SapConnectivityGuide` component pointing to the new `middleware/README.md` so admins know the recommended deployment path.

## Files to add / change

- **add** `middleware/package.json`
- **add** `middleware/server.js`
- **add** `middleware/.env.example`
- **add** `middleware/Dockerfile`
- **add** `middleware/README.md`
- **edit** `supabase/functions/sync-vendor-to-sap/index.ts` (route through middleware when configured)
- **edit** `src/components/sap/SapConnectivityGuide.tsx` (link to middleware README)

## Secrets to request after approval

- `SAP_MIDDLEWARE_URL` — public HTTPS URL of the middleware (e.g. `https://sap-proxy.ramky.com`)
- `SAP_MIDDLEWARE_KEY` — shared secret matching the middleware's `MIDDLEWARE_SHARED_SECRET`

(Existing `SAP_BP_API_URL` / `SAP_BP_USERNAME` / `SAP_BP_PASSWORD` move into the middleware's own `.env` and can be removed from Lovable Cloud once cutover is done.)

## Out of scope

- Hosting/deploying the middleware itself (customer-managed, infra decision).
- Changing the SAP payload mapping or the SAP Sync UI.
- Database migrations.

## Open question

Do you want the middleware to also expose a generic `/sap/proxy` endpoint now (so future APIs like PO/Invoice can reuse it), or keep it strict to `/sap/bp/create` only for this iteration?
