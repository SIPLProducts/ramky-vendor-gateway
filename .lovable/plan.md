## Goal

One self-contained shell script at the repo root — `setup-selfhost.sh` — that, when run on a fresh Ubuntu 22.04 server, brings up a fully working self-hosted Supabase stack for this VMS app via `docker compose`, with **zero manual steps** and **no port/secret errors** on re-runs.

The user already has `scripts/deploy-vms-server.sh` + `scripts/lib/*.sh`, but wants a **single file** they can drop on any Linux box and run.

## What the script will do

Run as `sudo bash setup-selfhost.sh` from the repo root. Idempotent and re-runnable.

1. **Preflight** — require root, Ubuntu/Debian, confirm CWD has `package.json` + `supabase/`. Create `./selfhost/` working dir (or honor `$APP_ROOT`).
2. **Install packages** (skippable with `--skip-deps`) — `curl, git, jq, openssl, python3, rsync, ufw, nginx, apache2-utils`, Node 20 (NodeSource), Docker Engine + Compose plugin.
3. **Fetch upstream Supabase docker stack** into `./selfhost/backend/` (shallow clone of `supabase/supabase`, copy `docker/`). Skip if already present.
4. **Generate secrets once** into `./selfhost/backend/.env.secrets` (chmod 600): `POSTGRES_PASSWORD`, `JWT_SECRET`, `ANON_KEY` + `SERVICE_ROLE_KEY` (HS256-minted in pure Python, 10-yr exp), `DASHBOARD_USERNAME/PASSWORD`, `SECRET_KEY_BASE`, `VAULT_ENC_KEY`, Logflare tokens, `POOLER_TENANT_ID`. Re-runs reuse the file unless `--reset-secrets`.
5. **Write `backend/.env`** from upstream `.env.example` and set: secrets, `SITE_URL`/`API_EXTERNAL_URL`/`SUPABASE_PUBLIC_URL` = `http://<HOST_IP>/supabase`, `STUDIO_*`, port vars, signup flags (email signup on, autoconfirm off).
6. **Write `docker-compose.override.yml`** binding `kong`, `studio`, `db`, and `supavisor` to `127.0.0.1` only, with the **pooler on its own host ports** (`5433` session, `6543` transaction) so it never clashes with `db:5432` — this was the exact failure from the last run.
7. **Free conflicting ports** — `docker compose down`, remove stray containers (`supabase-*`, `supavisor`, `realtime-dev.supabase-realtime`), then `docker rm -f` anything still publishing `8000/8443/3000/5432/5433/6543`. Final `ss -ltn` guard with a clear error message.
8. **Bring stack up** — `docker compose pull && docker compose up -d`, wait up to 180 s for Kong on `127.0.0.1:8000`.
9. **Apply this app's SQL migrations** — loop `supabase/migrations/*.sql` via `psql` against `127.0.0.1:5432`, tracked in `public._applied_migrations` so re-runs skip what's already applied.
10. **Sync edge functions** — `rsync supabase/functions/ backend/volumes/functions/`, `docker compose restart functions`.
11. **Build frontend** — write `.env.production` with `VITE_SUPABASE_URL=http://<HOST_IP>/supabase` + `VITE_SUPABASE_PUBLISHABLE_KEY=<ANON_KEY>`, `npm ci && npm run build`, copy `dist/` to `./selfhost/frontend/dist/`.
12. **Install middleware** (if `middleware/` exists) — `npm ci`, write `middleware/.env` with auto-generated `MIDDLEWARE_SHARED_SECRET`, install a `vms-middleware.service` systemd unit on `:3002`.
13. **Configure nginx** — single vhost on `:80` routing: `/` → `frontend/dist`, `/supabase/` → Kong `:8000`, `/studio/` → Studio `:3000` (basic-auth via htpasswd), `/api/` → middleware `:3002`. `nginx -t && systemctl reload nginx`.
14. **Firewall** — `ufw` allow 22 + 80, enable.
15. **Summary** — print URLs, Studio credentials, anon/service-role keys, and next-step commands (create first auth user, add `RESEND_API_KEY`/`CASHFREE_*`/`SAP_MIDDLEWARE_KEY` to `backend/.env`, `docker compose restart functions`).

## Flags

`--skip-deps`, `--skip-build`, `--skip-migrations`, `--skip-functions`, `--skip-nginx`, `--skip-middleware`, `--reset-secrets`, `--host-ip <ip>` (default: auto-detect via `hostname -I`).

## File layout produced

```text
./selfhost/
  backend/                  # upstream supabase docker stack + .env + override
    .env, .env.secrets, docker-compose.yml, docker-compose.override.yml
    volumes/{db,storage,functions,logs}/
  frontend/dist/            # built SPA served by nginx
  middleware/               # node service on :3002 (if present)
  logs/setup.log
```

## How the user runs it

```bash
# on dev machine
rsync -av --delete --exclude node_modules --exclude dist --exclude .git \
  ./ root@<server>:/opt/vms/source/

# on server
cd /opt/vms/source
sudo bash setup-selfhost.sh
```

Re-runs: just `sudo bash setup-selfhost.sh` again — secrets persist, migrations are tracked, ports are auto-freed.

## Notes / caveats (called out in summary)

- **No HTTPS** by default. Add Certbot later if a domain is pointed at the box.
- **`LOVABLE_API_KEY` is hosted-only.** Edge functions calling Lovable AI Gateway must be repointed to OpenAI/Gemini with the user's own key.
- Script writes everything to `./selfhost/` by default so it does not collide with the existing `/opt/Ramky_Applications/DEV/VMS/` layout. Pass `APP_ROOT=/opt/Ramky_Applications/DEV/VMS` to keep using that path.

## File to create

- `setup-selfhost.sh` (single file, ~600 lines, no `scripts/lib/*` dependency — all helpers inlined so it works when copied alone).
