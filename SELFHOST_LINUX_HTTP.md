# Self-Hosted Deployment — Ubuntu 22.04 (HTTP only, no SSL)

Target server: **10.200.1.7**
Access URL after setup: **http://10.200.1.7**

---

## 0. Fix internet / DNS first (your current blocker)

Your `apt update` failed because `archive.ubuntu.com` resolved to Cloudflare IPs (104.20.28.246, 172.66.152.176). Those are **not** Ubuntu mirrors — it means DNS is hijacked, broken, or the server has no real internet route.

### 0.1 Check connectivity
```bash
ping -c 3 8.8.8.8           # raw internet
ping -c 3 google.com        # DNS works?
cat /etc/resolv.conf        # what DNS is configured?
```

- If `ping 8.8.8.8` fails → no internet route. Talk to your network team / check gateway:
  ```bash
  ip route
  ```
- If `ping 8.8.8.8` works but `ping google.com` fails → DNS broken. Fix:
  ```bash
  sudo rm /etc/resolv.conf
  echo -e "nameserver 8.8.8.8\nnameserver 1.1.1.1" | sudo tee /etc/resolv.conf
  ```
- If your company uses an **HTTP proxy**, configure apt:
  ```bash
  sudo tee /etc/apt/apt.conf.d/95proxy >/dev/null <<EOF
  Acquire::http::Proxy "http://YOUR_PROXY:PORT";
  Acquire::https::Proxy "http://YOUR_PROXY:PORT";
  EOF
  ```
- Verify Ubuntu mirror resolves correctly (should be Canonical IPs, NOT Cloudflare):
  ```bash
  dig +short archive.ubuntu.com
  # expect 185.125.190.x or 91.189.x.x — NOT 104.20.x.x
  ```

Once `apt update` runs clean, continue.

---

## 1. Install base packages

```bash
sudo apt update && sudo apt upgrade -y
sudo apt install -y nginx git curl ufw ca-certificates gnupg lsb-release jq

# Node.js 20
curl -fsSL https://deb.nodesource.com/setup_20.x | sudo -E bash -
sudo apt install -y nodejs

# Docker + Compose
sudo install -m 0755 -d /etc/apt/keyrings
curl -fsSL https://download.docker.com/linux/ubuntu/gpg | sudo gpg --dearmor -o /etc/apt/keyrings/docker.gpg
echo "deb [arch=$(dpkg --print-architecture) signed-by=/etc/apt/keyrings/docker.gpg] https://download.docker.com/linux/ubuntu $(lsb_release -cs) stable" | sudo tee /etc/apt/sources.list.d/docker.list
sudo apt update
sudo apt install -y docker-ce docker-ce-cli containerd.io docker-buildx-plugin docker-compose-plugin

# Verify
node -v && npm -v && docker --version && nginx -v
```

---

## 2. Firewall (HTTP only)

```bash
sudo ufw allow 22/tcp
sudo ufw allow 80/tcp
sudo ufw --force enable
sudo ufw status
```

Keep 5432, 8000, 3000, 3002, 9000 **closed** — Nginx fronts everything.

---

## 3. Folder layout (already exists on your server)

```
/opt/Ramky_Applications/VMS/
├── backend       # Supabase self-host (docker compose)
├── frontend      # built React app (dist/)
├── middleware    # Node SAP middleware
├── nginx         # custom nginx config
├── ssl           # unused for HTTP
├── uploads
└── logs
```

---

## 4. Deploy the SAP Middleware

```bash
cd /opt/Ramky_Applications/VMS/middleware
# copy server.js + package.json + .env.example from your repo here
cp .env.example .env
nano .env
# set:
#   MIDDLEWARE_SHARED_SECRET=<long random>
#   SAP_BP_API_URL=http://10.200.1.2:8000/vendor/bp/create?sap-client=300
#   SAP_BP_USERNAME=<sap user>
#   SAP_BP_PASSWORD=<sap pass>

npm install --omit=dev

# Run as a systemd service
sudo tee /etc/systemd/system/vms-middleware.service >/dev/null <<'EOF'
[Unit]
Description=VMS SAP Middleware
After=network.target

[Service]
WorkingDirectory=/opt/Ramky_Applications/VMS/middleware
ExecStart=/usr/bin/node server.js
Restart=always
EnvironmentFile=/opt/Ramky_Applications/VMS/middleware/.env

[Install]
WantedBy=multi-user.target
EOF

sudo systemctl daemon-reload
sudo systemctl enable --now vms-middleware
sudo systemctl status vms-middleware
curl http://localhost:3002/health
```

---

## 5. Build & deploy the Frontend

On your **dev machine** (not the server) — build the React app:
```bash
git clone <your-repo>
cd <repo>
npm install
npm run build       # produces dist/
scp -r dist/* root@10.200.1.7:/opt/Ramky_Applications/VMS/frontend/
```

Or build on the server itself if Node is installed there.

---

## 6. Nginx config (HTTP only)

```bash
sudo tee /etc/nginx/sites-available/vms >/dev/null <<'EOF'
server {
    listen 80;
    server_name 10.200.1.7;

    client_max_body_size 500M;

    # Frontend (SPA)
    root /opt/Ramky_Applications/VMS/frontend;
    index index.html;

    location / {
        try_files $uri $uri/ /index.html;
    }

    # SAP middleware (only if you want to expose it via Nginx)
    location /sap/ {
        proxy_pass http://127.0.0.1:3002/sap/;
        proxy_set_header Host $host;
        proxy_set_header X-Real-IP $remote_addr;
        proxy_read_timeout 120s;
    }

    # Self-hosted Supabase (if running) — adjust ports as needed
    location /api/ {
        proxy_pass http://127.0.0.1:8000/;
        proxy_set_header Host $host;
        proxy_set_header X-Real-IP $remote_addr;
    }
}
EOF

sudo ln -sf /etc/nginx/sites-available/vms /etc/nginx/sites-enabled/vms
sudo rm -f /etc/nginx/sites-enabled/default
sudo nginx -t
sudo systemctl reload nginx
```

Open in browser: **http://10.200.1.7**

---

## 7. (Optional) Self-host Supabase backend

```bash
cd /opt/Ramky_Applications/VMS/backend
git clone --depth 1 https://github.com/supabase/supabase
cd supabase/docker
cp .env.example .env
nano .env   # set POSTGRES_PASSWORD, JWT_SECRET, ANON_KEY, SERVICE_ROLE_KEY, SITE_URL=http://10.200.1.7
docker compose up -d
docker compose ps
```

Then point your frontend `.env` to `VITE_SUPABASE_URL=http://10.200.1.7/api` and rebuild.

> Note: this app was built on Lovable Cloud. Moving fully off Lovable Cloud requires migrating schema, RLS policies, edge functions, and storage to your self-hosted Supabase. That's a separate, larger task.

---

## 8. Verify

```bash
systemctl status nginx vms-middleware
curl -I http://10.200.1.7/
curl http://10.200.1.7/sap/  # should hit middleware (401 without key is OK)
```

---

## Common issues

| Symptom | Fix |
|---|---|
| `apt` connection timeout to Cloudflare IPs | DNS hijacked — fix `/etc/resolv.conf` (section 0) |
| `node: command not found` | NodeSource repo step skipped — rerun section 1 |
| Nginx 502 on `/sap/` | middleware not running — `systemctl status vms-middleware` |
| Browser shows blank page | `frontend/` is empty or built without correct `VITE_SUPABASE_URL` — rebuild and redeploy |
| Can't reach from other PCs | firewall — `sudo ufw status`, ensure 80 allowed |

---

## 9. Redeploying after pulling new code

Whenever you pull updates from the repo, the **frontend bundle in nginx must be rebuilt** — otherwise users keep seeing the old UI.

```bash
cd /path/to/repo
git pull

# Rebuild frontend
npm ci || npm install
npm run build
sudo rsync -a --delete ./dist/ /var/www/sharvi/dist/
sudo nginx -s reload

# Redeploy edge functions (self-hosted Supabase does NOT auto-deploy)
supabase functions deploy admin-create-user --no-verify-jwt
supabase functions deploy smtp-config-save --no-verify-jwt
supabase functions deploy smtp-config-test --no-verify-jwt
supabase functions deploy smtp-config-delete --no-verify-jwt
# add any other functions you changed

# Or re-run the installer's function step
sudo bash scripts/deploy-vms-server.sh --only functions
```

Hard-refresh the browser (Ctrl+F5) or open incognito to bypass cached `index.html`.
