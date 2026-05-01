
# Windows Server Deployment Guide — Sharvi Vendor Portal

This project has two deployable pieces. The plan documents how to run both on a Windows Server (2019 / 2022) inside the customer network. No code changes are required; everything below is installation, configuration and a new `DEPLOYMENT_WINDOWS.md` doc added to the repo.

```text
[Browser] ──HTTPS──► [IIS on Windows Server :443]
                         │   (serves built React/Vite static files from C:\inetpub\sharvi-portal)
                         │
                         ▼
                 [Lovable Cloud Edge Functions]   (already hosted, no install)
                         │   HTTPS + x-middleware-key
                         ▼
              [Node.js SAP Middleware on same server :3002]
                         │   HTTP + Basic Auth
                         ▼
                 [SAP S/4HANA  10.200.1.2:8000]
```

The frontend is a static Vite/React build — it does NOT need Node.js at runtime. Node.js is only required (a) to build the frontend and (b) to run the SAP middleware service.

## What gets deployed

1. **Frontend (static site)** — `npm run build` output in `dist/`, served by IIS over HTTPS.
2. **SAP Middleware (Node.js service)** — `middleware/server.js`, run as a Windows Service on port 3002, exposed publicly via HTTPS so Lovable Cloud edge functions can reach it.
3. **Backend (Lovable Cloud / Supabase)** — already hosted, nothing to install on Windows. Edge functions, DB, auth, storage stay in Lovable Cloud.

---

## 1. Software to install on the Windows Server

Install in this order (all 64-bit):

| # | Software | Version | Purpose | Source |
|---|----------|---------|---------|--------|
| 1 | Windows Server | 2019 or 2022 | OS | Microsoft |
| 2 | IIS (Web Server role) | bundled | Hosts static frontend | Server Manager → Add Roles → Web Server (IIS). Enable: Static Content, Default Document, HTTP Errors, HTTP Redirection, URL Authorization, Request Filtering, Logging, Management Console |
| 3 | URL Rewrite Module 2.1 | latest | SPA fallback (deep links) | https://www.iis.net/downloads/microsoft/url-rewrite |
| 4 | Application Request Routing (ARR) 3.0 | latest | Reverse-proxy to middleware | https://www.iis.net/downloads/microsoft/application-request-routing |
| 5 | Node.js LTS | 20.x or 22.x | Build frontend + run middleware | https://nodejs.org/en/download (MSI) |
| 6 | Git for Windows | latest | Pull repo | https://git-scm.com/download/win |
| 7 | NSSM (Non-Sucking Service Manager) | 2.24 | Run Node service as Windows Service | https://nssm.cc/download |
| 8 | Win-acme (or your corporate CA cert) | latest | Free Let's Encrypt TLS for IIS | https://www.win-acme.com |
| 9 | (optional) VS Code | latest | Edit `.env` files | https://code.visualstudio.com |

Open Windows Firewall inbound rules: **TCP 80, 443** (public), **TCP 3002** (localhost only — do not expose; IIS reverse-proxies to it).

---

## 2. Frontend deployment (IIS)

### 2a. Build on the server (or build in CI and copy `dist/`)

```powershell
# As Administrator
cd C:\
git clone <YOUR_REPO_URL> sharvi-source
cd C:\sharvi-source
npm ci
npm run build
```

The build output is `C:\sharvi-source\dist`. Note: `.env` (Supabase URL / publishable key) is baked in at build time — values from `.env` in the repo are already correct for this project.

### 2b. Publish to IIS

```powershell
New-Item -ItemType Directory -Path C:\inetpub\sharvi-portal -Force
Copy-Item C:\sharvi-source\dist\* C:\inetpub\sharvi-portal -Recurse -Force
icacls C:\inetpub\sharvi-portal /grant "IIS_IUSRS:(OI)(CI)RX"
```

In **IIS Manager**:
- Add Website → Site name: `sharvi-portal`, Physical path: `C:\inetpub\sharvi-portal`, Binding: `https` on port 443, Host name: `vms.yourdomain.com`, choose your TLS cert.
- Add an HTTP→HTTPS redirect site on port 80 (optional but recommended).

### 2c. Add SPA fallback + MIME types

Create `C:\inetpub\sharvi-portal\web.config`:

```xml
<?xml version="1.0" encoding="UTF-8"?>
<configuration>
  <system.webServer>
    <staticContent>
      <remove fileExtension=".webmanifest" />
      <mimeMap fileExtension=".webmanifest" mimeType="application/manifest+json" />
      <remove fileExtension=".woff2" />
      <mimeMap fileExtension=".woff2" mimeType="font/woff2" />
    </staticContent>
    <rewrite>
      <rules>
        <!-- Don't rewrite real files / API / proxy -->
        <rule name="SPA Fallback" stopProcessing="true">
          <match url=".*" />
          <conditions logicalGrouping="MatchAll">
            <add input="{REQUEST_FILENAME}" matchType="IsFile" negate="true" />
            <add input="{REQUEST_FILENAME}" matchType="IsDirectory" negate="true" />
            <add input="{REQUEST_URI}" pattern="^/sap-proxy/" negate="true" />
          </conditions>
          <action type="Rewrite" url="/index.html" />
        </rule>
      </rules>
    </rewrite>
    <httpProtocol>
      <customHeaders>
        <add name="X-Content-Type-Options" value="nosniff" />
        <add name="Referrer-Policy" value="strict-origin-when-cross-origin" />
      </customHeaders>
    </httpProtocol>
  </system.webServer>
</configuration>
```

Browse `https://vms.yourdomain.com` — the portal should load and talk to Lovable Cloud directly (Supabase URL is already in the build).

---

## 3. SAP Middleware deployment (Windows Service)

### 3a. Install dependencies

```powershell
New-Item -ItemType Directory -Path C:\sharvi\middleware -Force
Copy-Item C:\sharvi-source\middleware\* C:\sharvi\middleware -Recurse -Force
cd C:\sharvi\middleware
npm install --omit=dev
Copy-Item .env.example .env
notepad .env
```

Set in `.env`:
```
PORT=3002
MIDDLEWARE_SHARED_SECRET=<generate a long random string, save it>
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

### 3b. Register as a Windows Service via NSSM

```powershell
# Unzip nssm and place nssm.exe in C:\Tools\nssm\
C:\Tools\nssm\nssm.exe install SharviSapMiddleware "C:\Program Files\nodejs\node.exe" "C:\sharvi\middleware\server.js"
C:\Tools\nssm\nssm.exe set    SharviSapMiddleware AppDirectory C:\sharvi\middleware
C:\Tools\nssm\nssm.exe set    SharviSapMiddleware AppStdout    C:\sharvi\middleware\logs\out.log
C:\Tools\nssm\nssm.exe set    SharviSapMiddleware AppStderr    C:\sharvi\middleware\logs\err.log
C:\Tools\nssm\nssm.exe set    SharviSapMiddleware Start        SERVICE_AUTO_START
C:\Tools\nssm\nssm.exe start  SharviSapMiddleware
```

### 3c. Expose middleware over HTTPS via IIS reverse proxy

Lovable Cloud edge functions live on the public internet, so they need an HTTPS URL to reach the middleware. Easiest option on the same Windows Server: reverse-proxy through IIS using ARR.

In **IIS Manager** → server node → **Application Request Routing Cache** → *Server Proxy Settings* → tick **Enable proxy**.

On the `sharvi-portal` site, add this rule to `web.config` (inside `<rules>`, before SPA fallback):

```xml
<rule name="Sap Middleware Proxy" stopProcessing="true">
  <match url="^sap-proxy/(.*)" />
  <action type="Rewrite" url="http://localhost:3002/{R:1}" />
</rule>
```

Public URL of the middleware becomes:
`https://vms.yourdomain.com/sap-proxy`  (e.g. `/sap-proxy/health`, `/sap-proxy/sap/bp/create`).

Alternative: a separate IIS site `https://sap.yourdomain.com` proxying `/` → `http://localhost:3002/`.

### 3d. Tell Lovable Cloud where the middleware is

In Lovable: **Connectors → Lovable Cloud → Secrets**, set:
- `SAP_MIDDLEWARE_URL` = `https://vms.yourdomain.com/sap-proxy`  (or `https://sap.yourdomain.com`)
- `SAP_MIDDLEWARE_KEY` = same value as `MIDDLEWARE_SHARED_SECRET` from the `.env`

Then in the portal: **SAP API Settings** → Business Partner config → Connection Mode = *Via Proxy Server*, paste the same URL into **Node.js Middleware URL**, paste the secret into **Proxy Secret / Password**, click **Test SAP connection** — expect `HTTP 200, proxy secret accepted`.

---

## 4. TLS certificate

Pick one:
- **Let's Encrypt** via win-acme: `wacs.exe`, choose IIS site `sharvi-portal`, follow prompts. Auto-renews via Scheduled Task.
- **Corporate / commercial cert**: import `.pfx` into Local Computer → Personal store, bind to the IIS site on 443.

---

## 5. Updates / redeploy

Frontend update:
```powershell
cd C:\sharvi-source
git pull
npm ci
npm run build
Copy-Item dist\* C:\inetpub\sharvi-portal -Recurse -Force
iisreset /noforce    # optional; usually unnecessary for static files
```

Middleware update:
```powershell
cd C:\sharvi\middleware
git -C C:\sharvi-source pull
Copy-Item C:\sharvi-source\middleware\server.js .\server.js -Force
npm install --omit=dev
C:\Tools\nssm\nssm.exe restart SharviSapMiddleware
```

---

## 6. Verification checklist

1. `https://vms.yourdomain.com` loads, login works, Supabase calls succeed (DevTools → Network shows `kntaaugefxhymmrvivaj.supabase.co` 200s).
2. `https://vms.yourdomain.com/sap-proxy/health` returns `{ ok: true }`.
3. SAP API Settings → **Test SAP connection** → green “Middleware reachable and proxy secret accepted”.
4. Create a test vendor → click **SAP Sync** → vendor record reaches SAP.
5. Service survives reboot: restart the server, then re-run steps 2–4.

---

## 7. Files that will be added to the repo (only documentation)

- `DEPLOYMENT_WINDOWS.md` — the full guide above (so it lives with the code).
- `iis/web.config` — sample IIS config with SPA fallback + ARR proxy rule.
- `middleware/install-windows-service.ps1` — one-shot PowerShell script that wraps the NSSM commands in section 3b.

No application source code, no Supabase schema, and no edge function changes are needed.

---

## Technical notes

- The frontend reads `VITE_SUPABASE_URL` / `VITE_SUPABASE_PUBLISHABLE_KEY` at build time from `.env`. Those values are already correct for this project; do NOT change them on the server unless you're pointing at a different Supabase project.
- Do not expose port 3002 to the internet directly — keep it bound to localhost and front it with IIS+ARR (TLS terminates at IIS).
- `NODE_TLS_REJECT_UNAUTHORIZED=0` (via `ALLOW_INSECURE_TLS=1`) should only be enabled if SAP uses a self-signed cert on the internal network.
- The middleware only accepts requests with header `x-middleware-key: <SHARED_SECRET>`. Rotate the secret by updating both `middleware/.env` and the `SAP_MIDDLEWARE_KEY` Lovable Cloud secret, then `nssm restart SharviSapMiddleware`.
- IIS Application Pool for `sharvi-portal` can run as `ApplicationPoolIdentity` — the site is fully static, no .NET code executes.
