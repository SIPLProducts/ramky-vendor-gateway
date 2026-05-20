# VMS Self-Hosted Deployment

End-to-end bootstrap for the **DEV** environment on Ubuntu 22.04 at
`10.200.1.7`, using the existing layout under
`/opt/Ramky_Applications/DEV/VMS/`.

Everything reaches users through **nginx on port 80** — no other ports
are exposed to the LAN.

```
Browser  http://10.200.1.7/...
              │
        nginx :80
   ┌──────────┼──────────────┬──────────────┐
   ▼          ▼              ▼              ▼
   /          /supabase/     /api/          /studio/
 React      Kong :8000     Middleware       Studio :3000
 SPA        (REST/Auth/    :3002            (basic-auth)
            Storage/RT/
            Functions)
```

## 1. From your dev machine

Sync this repo to the server:

```bash
rsync -av --delete \
  --exclude node_modules --exclude dist --exclude .git \
  ./ root@10.200.1.7:/opt/Ramky_Applications/DEV/VMS/source/
```

## 2. On the server

```bash
ssh root@10.200.1.7
cd /opt/Ramky_Applications/DEV/VMS/source
sudo bash scripts/deploy-vms-server.sh
```

First run: ~5–10 min. Re-runs are safe (secrets persisted, migrations tracked).

### Flags

| Flag | Effect |
| --- | --- |
| `--skip-docker` | Skip apt / Docker / Node install |
| `--skip-build` | Reuse existing `frontend/dist/` |
| `--skip-migrations` | Don't apply SQL migrations |
| `--skip-functions` | Don't re-sync edge functions |
| `--skip-nginx` | Don't touch nginx config |
| `--skip-middleware` | Don't touch middleware service |
| `--reset-secrets` | Regenerate `backend/.env.secrets` (invalidates JWTs) |

## 3. What the script does

1. Installs Node 20, Docker + Compose, nginx, ufw, htpasswd.
2. Clones `supabase/supabase` `docker/` into `backend/`, generates strong
   secrets once (`backend/.env.secrets`, chmod 600), writes `backend/.env`
   with `SITE_URL`, `API_EXTERNAL_URL`, `SUPABASE_PUBLIC_URL` pointing to
   `http://10.200.1.7/supabase`. Adds a `docker-compose.override.yml` that
   binds Kong / Studio / Postgres to `127.0.0.1` only.
3. Brings the stack up (`docker compose up -d`) and waits for Kong.
4. Applies `supabase/migrations/*.sql` via `psql`, tracked in
   `public._applied_migrations` so re-runs skip what's already applied.
5. `rsync`s `supabase/functions/` into `backend/volumes/functions/` and
   restarts the `functions` container.
6. Installs middleware (`npm ci`), writes `middleware/.env` with an
   auto-generated `MIDDLEWARE_SHARED_SECRET` (if missing), installs the
   `vms-middleware.service` systemd unit on `:3002`.
7. Builds the React app with
   `VITE_SUPABASE_URL=http://10.200.1.7/supabase` and
   `VITE_SUPABASE_PUBLISHABLE_KEY=<ANON_KEY>`. Output goes to
   `frontend/dist/`.
8. Writes `/opt/Ramky_Applications/nginx/ramky-vms.conf` (backup of any
   previous version), symlinks into `/etc/nginx/sites-enabled/`, reloads nginx.
9. `ufw` allows 22 + 80 only.
10. Prints a summary with URLs, credentials, and next steps.

## 4. After setup

Run the steps the summary prints:

1. Open `http://10.200.1.7/studio/` (basic-auth credentials in the summary)
   and create the first auth user.
2. In Studio SQL editor:
   ```sql
   insert into public.user_roles (user_id, role)
   values ('<auth-user-uuid>', 'sharvi_admin');
   ```
3. Add edge-function secrets to `/opt/Ramky_Applications/DEV/VMS/backend/.env`
   then `docker compose restart functions`:
   - `RESEND_API_KEY`
   - `CASHFREE_CLIENT_ID`, `CASHFREE_CLIENT_SECRET`
   - `SAP_MIDDLEWARE_KEY` (must equal the middleware's
     `MIDDLEWARE_SHARED_SECRET`)
4. Edit the SAP values in `/opt/Ramky_Applications/DEV/VMS/middleware/.env`
   (`SAP_BP_API_URL`, `SAP_BP_USERNAME`, `SAP_BP_PASSWORD`) and
   `systemctl restart vms-middleware`.
5. Open `http://10.200.1.7/` and sign in.

### Sanity checks

```bash
curl -I http://10.200.1.7/
curl    http://10.200.1.7/api/health
curl    http://10.200.1.7/supabase/auth/v1/health

systemctl status nginx vms-middleware
docker compose -f /opt/Ramky_Applications/DEV/VMS/backend/docker-compose.yml ps
```

### Day-2 commands

```bash
# Supabase
cd /opt/Ramky_Applications/DEV/VMS/backend
docker compose ps
docker compose logs -f kong auth rest studio functions
docker compose restart functions

# Middleware
journalctl -u vms-middleware -f

# Nginx
nginx -t && systemctl reload nginx
tail -f /opt/Ramky_Applications/DEV/VMS/logs/{access,error}.log

# Code update only (no docker reinstall, no schema changes)
cd /opt/Ramky_Applications/DEV/VMS/source && git pull   # or rsync
sudo bash scripts/deploy-vms-server.sh --skip-docker --skip-migrations
```

## Notes

- **No HTTPS** in this script. To add later: Certbot against
  `dev-vms.ramky.com`. No other changes needed.
- **`LOVABLE_API_KEY` (Lovable AI Gateway) is hosted-only.** Edge
  functions that call it must be repointed at OpenAI / Gemini with your
  own key once self-hosted.
- The script edits `/opt/Ramky_Applications/nginx/ramky-vms.conf` in
  place. A `.bak.<timestamp>` is saved before each rewrite.
