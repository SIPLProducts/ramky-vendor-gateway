## Problem

Deploy fails at the `docker compose up -d` step because **two containers want host port 5432**:
- `db` (Postgres) — bound to 5432 via our override
- `supabase-pooler` (Supavisor) — also defaults to publishing 5432 on the host

Our `docker-compose.override.yml` only remaps `kong`, `studio`, and `db`, so the pooler keeps its upstream port mappings and collides.

## Fix

Update `scripts/lib/20-supabase.sh` to:

1. **Add `POOLER_PROXY_PORT_TRANSACTION` config** (default `6543`) and export it. Also add `POOLER_DB_PORT` (host port for the pooler's session-mode 5432, default `5433`) so it never clashes with `db`.

2. **Extend `docker-compose.override.yml`** to pin the pooler to localhost and to non-conflicting host ports:
   ```yaml
   supavisor:           # service name in supabase compose
     ports:
       - "127.0.0.1:${POOLER_DB_PORT}:5432/tcp"
       - "127.0.0.1:${POOLER_PROXY_PORT_TRANSACTION}:6543/tcp"
   ```
   (Service is `supavisor` in upstream compose; container name is `supabase-pooler`.)

3. **Pre-flight free the ports**: before `docker compose up`, in addition to the existing stray-container loop, run a small helper that, for each of `KONG_HTTP_PORT`, `KONG_HTTPS_PORT`, `STUDIO_PORT`, `POSTGRES_PORT`, `POOLER_DB_PORT`, `POOLER_PROXY_PORT_TRANSACTION`:
   - find any leftover `docker-proxy` / container publishing that port (`docker ps --filter "publish=<port>" -q`) and `docker rm -f` it.
   - then run the existing `check_port` guard.

4. **Add the new ports** (`5433`, `6543`) to `check_port` calls and (optionally) include `supavisor` in the stray-container cleanup list.

5. **Also set the pooler env vars** in `.env` via `set_env` so the upstream compose picks them up:
   - `POOLER_PROXY_PORT_TRANSACTION=6543`
   - `POOLER_DEFAULT_POOL_SIZE`, `POOLER_MAX_CLIENT_CONN` — leave defaults.

## What the user does after the fix

Re-sync and re-run:
```bash
# on dev machine
rsync -av --delete --exclude node_modules --exclude dist --exclude .git \
  ./ root@10.200.1.7:/opt/Ramky_Applications/DEV/VMS/source/

# on server
cd /opt/Ramky_Applications/DEV/VMS/source
sudo bash scripts/deploy-vms-server.sh
```

The pooler will now publish on `127.0.0.1:6543` (transaction mode) and `127.0.0.1:5433` (session mode), leaving `127.0.0.1:5432` to the `db` container.

## Files to change

- `scripts/lib/20-supabase.sh` — add pooler port vars, extend override YAML, extend port pre-flight + check, extend stray-container list.
- `scripts/deploy-vms-server.sh` — export `POOLER_DB_PORT` and `POOLER_PROXY_PORT_TRANSACTION` defaults at the top alongside the other `*_PORT` exports.

No application code changes.
