## Clarification: SAP API Settings in the app vs. middleware `.env`

### Question
The middleware `.env` on the self-hosted server currently has empty values for:
- `SAP_BP_API_URL`
- `SAP_DMS_API_URL`
- `SAP_BP_USERNAME`
- `SAP_BP_PASSWORD`

The app already has SAP API Settings configured for each API. Is it necessary to configure these values again in the middleware `.env`?

### Short answer
Yes — the middleware `.env` must contain the real SAP endpoint URL and Basic Auth credentials. The app's SAP API Settings and the middleware `.env` are two separate layers.

### How the two layers work

```text
App (SAP API Settings)
  ├─ stores the public middleware URL (middleware_url)
  ├─ stores the shared proxy secret (proxy_secret)
  ├─ stores direct-connection details (base_url + endpoint_path) only when "Connection = Direct"
  └─ does NOT send SAP username/password to the middleware

Middleware (Node.js server inside your network)
  ├─ reads SAP_BP_API_URL from its own .env
  ├─ reads SAP_DMS_API_URL from its own .env
  ├─ reads SAP_BP_USERNAME / SAP_BP_PASSWORD from its own .env
  └─ forwards the payload to SAP using these credentials
```

Why the middleware keeps its own credentials: the SAP username/password must never leave the customer's network. The app only knows the middleware URL and the shared secret; the middleware knows the SAP credentials.

### Required immediate fix on the self-hosted server

Edit `/opt/Ramky_Applications/PROD/VMS/middleware/.env` and fill the empty values, then restart the service.

```bash
# Example values — replace with your actual SAP host/credentials
SAP_BP_API_URL=https://49.207.9.62:44325/vendor/bp/create?sap-client=100
SAP_DMS_API_URL=https://49.207.9.62:44325/vendor/bp/create?sap-client=100
SAP_BP_USERNAME=s23hana2
SAP_BP_PASSWORD=Sh@rv!3220
```

Also remove the duplicate/empty `SAP_BP_USERNAME=` and `SAP_BP_PASSWORD=` lines that currently appear after the placeholders; keep only one populated pair.

Then restart:

```bash
sudo systemctl restart vms-middleware
# or, if running manually:
# cd /opt/Ramky_Applications/PROD/VMS/middleware && node server.js
```

Verify the middleware is ready:

```bash
curl -s http://localhost:3012/health | python3 -m json.tool
```

The field `sapConfigured` should become `true` after the restart.

### Proposed small improvements

1. **Middleware health check already reports config state** — the app can use `sapConfigured` and `dmsConfigured` from `/health` to show a clearer warning when the middleware `.env` is incomplete.
2. **Update SAP Connectivity Guide** in the app to explicitly state that the middleware `.env` must hold the SAP credentials, while the SAP API Settings screen only holds the middleware URL and proxy secret.
3. **Optional: allow the middleware to be told the target URL per request** so the app can send `sapUrl` + `sapUsername` + `sapPassword` per API config, removing the duplicate configuration. This is a larger security/architecture change because credentials would travel from the app to the middleware; recommend keeping the credentials local to the middleware.

### Recommended next step

Start with the immediate fix above (fill the middleware `.env` and restart). If the goal is to reduce confusion, also apply improvement #2 (guide update) so the next admin does not face the same question.
