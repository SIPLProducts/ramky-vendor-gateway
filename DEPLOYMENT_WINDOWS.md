# Windows Server Deployment Guide — Sharvi Vendor Portal

This guide describes how to host the **Sharvi Vendor Portal** on a Windows Server (2019 / 2022) inside the customer network.

There are two deployable pieces:

1. **Frontend** — a static React/Vite build served by **IIS** over HTTPS.
2. **SAP Middleware** — a Node.js service (`middleware/server.js`) that lives on the same server, runs as a **Windows Service**, and forwards requests from Lovable Cloud Edge Functions to the internal SAP S/4HANA Business Partner API.

The **backend** (database, auth, storage, edge functions) runs in **Lovable Cloud** and does **not** need to be installed on the Windows Server.

```text
[Browser] ──HTTPS──► [IIS on Windows Server :443]
                         │   serves static files from C:\inetpub\sharvi-portal
                         │
                         ▼
                 [Lovable Cloud Edge Functions]   (already hosted)
                         │   HTTPS + x-middleware-key
                         ▼
              [Node.js SAP Middleware on same server :3002]
                         │   HTTP + Basic Auth
                         ▼
                 [SAP S/4HANA  10.200.1.2:8000]
```

> The frontend does **not** need Node.js at runtime. Node.js is only required (a) to build the frontend and (b) to run the SAP middleware service.

---

## 1. Software to install on the Windows Server

Install in this order (all 64-bit):

| # | Software | Version | Purpose | Source |
|---|----------|---------|---------|--------|
| 1 | Windows Server | 2019 or 2022 | OS | Microsoft |
| 2 | IIS (Web Server role) | bundled | Hosts the static frontend | Server Manager → Add Roles → **Web Server (IIS)**. Enable: Static Content, Default Document, HTTP Errors, HTTP Redirection, URL Authorization, Request Filtering, Logging, Management Console |
| 3 | URL Rewrite Module 2.1 | latest | SPA fallback (deep links) | <https://www.iis.net/downloads/microsoft/url-rewrite> |
| 4 | Application Request Routing (ARR) 3.0 | latest | Reverse-proxy IIS → middleware | <https://www.iis.net/downloads/microsoft/application-request-routing> |
| 5 | Node.js LTS | 20.x or 22.x | Build frontend + run middleware | <https://nodejs.org/en/download> (MSI) |
| 6 | Git for Windows | latest | Pull source | <https://git-scm.com/download/win> |
| 7 | NSSM | 2.24 | Run Node service as a Windows Service | <https://nssm.cc/download> |
| 8 | win-acme (or your corporate CA cert) | latest | Free Let's Encrypt TLS for IIS | <https://www.win-acme.com> |
| 9 | (optional) VS Code | latest | Edit `.env` files | <https://code.visualstudio.com> |

**Windows Firewall — inbound rules:**
- TCP **80** (public, redirects to 443)
- TCP **443** (public)
- TCP **3002** — leave **closed to the public**. IIS reverse-proxies to it on `localhost`.

---

## 2. Frontend deployment (IIS)

### 2a. Build

```powershell
# Run as Administrator
cd C:\
git clone <YOUR_REPO_URL> sharvi-source
cd C:\sharvi-source
npm ci
npm run build
```

The build output is `C:\sharvi-source\dist`.

> The Supabase URL and publishable key are baked into the build at compile time from `.env`. The values committed to the repo are correct for this project — do not change them on the server unless you are pointing at a different Supabase project.

### 2b. Publish to IIS

```powershell
New-Item -ItemType Directory -Path C:\inetpub\sharvi-portal -Force
Copy-Item C:\sharvi-source\dist\* C:\inetpub\sharvi-portal -Recurse -Force
icacls C:\inetpub\sharvi-portal /grant "IIS_IUSRS:(OI)(CI)RX"
```

In **IIS Manager**:

1. **Add Website**
   - Site name: `sharvi-portal`
   - Physical path: `C:\inetpub\sharvi-portal`
   - Binding: `https` on port `443`
   - Host name: `vms.yourdomain.com`
   - SSL certificate: select your TLS cert (see section 4)
2. (Optional) Add a second site on port 80 that redirects HTTP → HTTPS.

### 2c. Add SPA fallback + reverse-proxy rule

Copy `iis/web.config` from this repo to `C:\inetpub\sharvi-portal\web.config`. It contains:

- A rewrite rule that proxies `/sap-proxy/*` to `http://localhost:3002/*` (used by the middleware).
- An SPA-fallback rule that rewrites unknown paths to `/index.html` so React Router can handle deep links / page refreshes.
- Correct MIME types for `.webmanifest` and `.woff2`.
- Basic security headers.

Browse `https://vms.yourdomain.com` — the portal should load and talk to Lovable Cloud directly.

---

## 3. SAP Middleware deployment (Windows Service)

### 3a. Install

```powershell
New-Item -ItemType Directory -Path C:\sharvi\middleware -Force
Copy-Item C:\sharvi-source\middleware\* C:\sharvi\middleware -Recurse -Force
cd C:\sharvi\middleware
npm install --omit=dev
Copy-Item .env.example .env
notepad .env
```

Set in `.env`:

```env
PORT=3002
MIDDLEWARE_SHARED_SECRET=<generate a long random string and save it>
SAP_BP_API_URL=http://10.200.1.2:8000/vendor/bp/create?sap-client=300
SAP_BP_USERNAME=22000208
SAP_BP_PASSWORD=********
SAP_REQUEST_TIMEOUT_MS=30000
CORS_ORIGINS=*
ALLOW_INSECURE_TLS=0     # set to 1 only if SAP uses a self-signed cert
```

Test once interactively:

```powershell
node server.js
# In another shell:
curl http://localhost:3002/health
```

### 3b. Register as a Windows Service

Use the helper script in this repo:

```powershell
# Place nssm.exe at C:\Tools\nssm\nssm.exe first
powershell -ExecutionPolicy Bypass -File C:\sharvi-source\middleware\install-windows-service.ps1
```

The script wraps the standard NSSM commands (see the script for details), points the service at `C:\sharvi\middleware\server.js`, writes logs to `C:\sharvi\middleware\logs\`, and sets it to start automatically with Windows.

Manage the service:

```powershell
nssm start    SharviSapMiddleware
nssm stop     SharviSapMiddleware
nssm restart  SharviSapMiddleware
nssm remove   SharviSapMiddleware confirm
```

### 3c. Expose the middleware over HTTPS via IIS reverse proxy

The Lovable Cloud edge functions live on the public internet, so they need an HTTPS URL to reach the middleware. The `web.config` shipped in this repo already includes a reverse-proxy rule:

```
https://vms.yourdomain.com/sap-proxy/health         → http://localhost:3002/health
https://vms.yourdomain.com/sap-proxy/sap/bp/create  → http://localhost:3002/sap/bp/create
```

To enable it, in **IIS Manager** → server node → **Application Request Routing Cache** → *Server Proxy Settings* → tick **Enable proxy** → Apply.

Verify:
```
https://vms.yourdomain.com/sap-proxy/health   →   { "ok": true, ... }
```

### 3d. Tell Lovable Cloud where the middleware is

In Lovable: **Connectors → Lovable Cloud → Secrets**, set:

- `SAP_MIDDLEWARE_URL` = `https://vms.yourdomain.com/sap-proxy`
- `SAP_MIDDLEWARE_KEY` = the same value as `MIDDLEWARE_SHARED_SECRET` from `.env`

Then in the portal: **SAP API Settings → Business Partner config**:

- Connection Mode = *Via Proxy Server*
- Node.js Middleware URL = `https://vms.yourdomain.com/sap-proxy`
- Proxy Secret / Password = the same `MIDDLEWARE_SHARED_SECRET`
- Click **Test SAP connection** — expect `Middleware reachable and proxy secret accepted`.

---

## 4. TLS certificate

Choose one:

- **Let's Encrypt** via win-acme — run `wacs.exe`, choose the IIS site `sharvi-portal`, follow prompts. A Scheduled Task auto-renews.
- **Corporate / commercial cert** — import the `.pfx` into `Local Computer → Personal` store and bind it to the IIS site on 443.

---

## 5. Updates / redeploy

**Frontend:**

```powershell
cd C:\sharvi-source
git pull
npm ci
npm run build
Copy-Item dist\* C:\inetpub\sharvi-portal -Recurse -Force
```

**Middleware:**

```powershell
cd C:\sharvi-source
git pull
Copy-Item middleware\server.js C:\sharvi\middleware\server.js -Force
cd C:\sharvi\middleware
npm install --omit=dev
nssm restart SharviSapMiddleware
```

---

## 6. Verification checklist

1. `https://vms.yourdomain.com` loads, login works, browser DevTools → Network shows successful calls to `kntaaugefxhymmrvivaj.supabase.co`.
2. `https://vms.yourdomain.com/sap-proxy/health` returns `{ "ok": true }`.
3. **SAP API Settings → Test SAP connection** shows green "Middleware reachable and proxy secret accepted".
4. Create a test vendor → click **SAP Sync** → record reaches SAP.
5. Reboot the server — service restarts automatically; repeat steps 2–4.

---

## 7. Security notes

- Do **not** expose port 3002 to the internet directly. Keep it bound to `localhost` and front it with IIS + ARR (TLS terminates at IIS).
- The middleware only accepts requests with header `x-middleware-key: <SHARED_SECRET>`. To rotate the secret, update both `middleware/.env` and the Lovable Cloud `SAP_MIDDLEWARE_KEY` secret, then `nssm restart SharviSapMiddleware`.
- Set `ALLOW_INSECURE_TLS=1` only if your SAP server uses a self-signed cert on the internal network.
- The IIS Application Pool for `sharvi-portal` can run as `ApplicationPoolIdentity` — the site is fully static, no .NET code executes.
