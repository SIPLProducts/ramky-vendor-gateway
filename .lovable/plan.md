# Fix: Self-hosted nginx changes for PDF → JPEG OCR

## Background

On the self-hosted box (`http://10.200.1.7/`), uploading a **PDF** to GST OCR fails with `no_gstin_detected`, because the client-side PDF→JPEG step (`src/lib/pdfToImage.ts`, using pdf.js) is silently failing and the **raw PDF** is shipped to Surepass. Lovable preview / SIPL cloud works because Vite serves the pdf.js worker `.mjs` with the correct MIME type and permissive headers.

Two things need to be true on the server:

1. `.mjs` (and `.wasm`) must be served with the correct `Content-Type`.
2. Nothing in nginx should block inline workers / blobs (no restrictive CSP).

Your current vhost is fine in structure — it just needs MIME and a couple of safety headers. **No location blocks need to be reordered or removed.**

## Changes to `/opt/Ramky_Applications/nginx/ramky-vms.conf`

### 1. Add a `types` block inside the `server { }` (before `location /`)

This is the critical fix. Without it, nginx serves `pdf.worker.min-*.mjs` as `application/octet-stream`, the browser refuses to execute it as a module, and pdf.js silently fails → raw PDF is uploaded.

```nginx
    # Correct MIME for ES modules and wasm (required by pdf.js worker)
    types {
        application/javascript  js mjs;
        application/wasm        wasm;
        text/css                css;
        image/svg+xml           svg svgz;
        application/manifest+json  webmanifest;
    }
    default_type application/octet-stream;
```

Place it right after `client_max_body_size 500M;` and before the `location /` block.

### 2. Long-cache hashed Vite assets (optional but recommended)

Inside `location / { … }` is fine, or add a sibling block:

```nginx
    location /assets/ {
        expires 1y;
        add_header Cache-Control "public, immutable";
        try_files $uri =404;
    }
```

### 3. Do **not** set a restrictive `Content-Security-Policy`

If you have any `add_header Content-Security-Policy ...` line anywhere (including in `nginx.conf` http{} block), it must allow workers and blobs for pdf.js to run:

```
worker-src 'self' blob:;
script-src 'self' 'wasm-unsafe-eval' blob:;
child-src  'self' blob:;
```

If you have **no** CSP header today, **do nothing here** — the browser default is permissive.

### 4. Verify your edit

```bash
sudo nginx -t
sudo systemctl reload nginx

# .mjs must come back as application/javascript
curl -sI http://10.200.1.7/assets/$(ls /opt/Ramky_Applications/DEV/VMS/frontend/dist/assets | grep '^pdf.worker.*\.mjs$' | head -1) | grep -i content-type
```

Expected: `Content-Type: application/javascript`. If you still see `application/octet-stream`, the `types { }` block didn't get applied.

## Why this is the only nginx-side change needed

- The `/api/`, `/supabase/`, `/studio/`, `/uploads/` proxies are unrelated to OCR file conversion — that happens **entirely in the browser** before the file is uploaded.
- `client_max_body_size 500M;` is already large enough.
- The middleware port change to native `/sap` and `/health` you already added is unrelated to this bug — leave it as is.

## Out of scope (handled separately, client-side code)

The matching code fix in `src/lib/pdfToImage.ts` (removing `disableWorker: true` and surfacing real conversion errors instead of silently shipping the raw PDF) is what you already have queued. Apply that **and** these nginx changes together, then rebuild the frontend (`npm run build`) and hard-refresh.

## Final updated vhost (drop-in)

```nginx
# Auto-managed by deploy-vms-server.sh — edits will be overwritten on next run.
server {
    listen 80;
    server_name dev-vms.ramky.com 10.200.1.7 localhost;

    root /opt/Ramky_Applications/DEV/VMS/frontend/dist;
    index index.html;

    client_max_body_size 500M;

    # Correct MIME for ES modules and wasm (required by pdf.js worker)
    types {
        application/javascript  js mjs;
        application/wasm        wasm;
        text/css                css;
        image/svg+xml           svg svgz;
        application/manifest+json  webmanifest;
    }
    default_type application/octet-stream;

    access_log /opt/Ramky_Applications/DEV/VMS/logs/access.log;
    error_log  /opt/Ramky_Applications/DEV/VMS/logs/error.log;

    # ---- Frontend SPA ----
    location / {
        try_files $uri $uri/ /index.html;
    }

    # Long-cache hashed Vite assets
    location /assets/ {
        expires 1y;
        add_header Cache-Control "public, immutable";
        try_files $uri =404;
    }

    # ---- SAP middleware native paths ----
    location ~ ^/(sap|health|api)(/|$) {
        proxy_pass http://127.0.0.1:3002;
        proxy_http_version 1.1;
        proxy_set_header Host $host;
        proxy_set_header X-Real-IP $remote_addr;
        proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
        proxy_set_header X-Forwarded-Proto $scheme;
        proxy_read_timeout 120s;
    }

    # ---- Supabase Kong gateway ----
    location /supabase/ {
        proxy_pass http://127.0.0.1:8000/;
        proxy_http_version 1.1;
        proxy_set_header Upgrade $http_upgrade;
        proxy_set_header Connection "upgrade";
        proxy_set_header Host $host;
        proxy_set_header X-Real-IP $remote_addr;
        proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
        proxy_set_header X-Forwarded-Proto $scheme;
        proxy_read_timeout 120s;
    }

    # ---- Supabase Studio ----
    location /studio/ {
        auth_basic           "Supabase Studio";
        auth_basic_user_file /etc/nginx/.vms-studio.htpasswd;
        proxy_pass http://127.0.0.1:3000/;
        proxy_http_version 1.1;
        proxy_set_header Upgrade $http_upgrade;
        proxy_set_header Connection "upgrade";
        proxy_set_header Host $host;
        proxy_set_header X-Real-IP $remote_addr;
        proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
        proxy_set_header X-Forwarded-Proto $scheme;
    }

    # ---- Uploads ----
    location /uploads/ {
        alias /opt/Ramky_Applications/DEV/VMS/uploads/;
        autoindex off;
    }

    location ~ /\. { deny all; }
}
```

## Apply

```bash
sudo nano /opt/Ramky_Applications/nginx/ramky-vms.conf   # paste the block above
sudo nginx -t
sudo systemctl reload nginx
```

Then ask users to **hard-refresh** (Ctrl+F5). PDF GST uploads should now convert to JPEG before reaching Surepass.
