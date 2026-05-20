# Ops scripts

## `setup-selfhosted-supabase.sh`

Bootstraps a complete self-hosted Supabase stack on the DEV server
(`10.200.1.7`) under `/opt/Ramky_Applications/DEV/supabase`.

### What it does

1. Installs Docker Engine + Compose plugin (skipped if already present).
2. Clones the upstream `supabase/supabase` `docker/` stack into
   `/opt/Ramky_Applications/DEV/supabase` (skipped if already there).
3. Generates strong random secrets (`POSTGRES_PASSWORD`, `JWT_SECRET`,
   dashboard user/pass, vault keys, Logflare tokens) and mints `ANON_KEY`
   + `SERVICE_ROLE_KEY` JWTs locally. All values are saved to
   `/opt/Ramky_Applications/DEV/supabase/.env.secrets` (chmod 600).
4. Writes `.env` from `.env.example`, substituting the secrets and setting
   `SITE_URL`, `API_EXTERNAL_URL`, `SUPABASE_PUBLIC_URL` to
   `http://10.200.1.7:<port>`.
5. Opens ufw ports 22 / 80 / 3000 / 8000 (only if ufw is active).
   Postgres `5432` is left **closed** to the outside world.
6. `docker compose pull && docker compose up -d`, then waits for Kong.
7. Prints a summary with Studio URL, login, key fingerprints, and the
   path to `.env.secrets`.

The script is idempotent — re-running it will not regenerate secrets or
re-clone the stack; it only refreshes `.env` and restarts containers if
needed.

### Run it

```bash
# from your dev machine
scp scripts/setup-selfhosted-supabase.sh root@10.200.1.7:/root/

# on the server
ssh root@10.200.1.7
sudo bash /root/setup-selfhosted-supabase.sh
```

Override defaults with env vars if needed:

```bash
sudo HOST_IP=10.200.1.7 STUDIO_PORT=3000 KONG_HTTP_PORT=8000 \
     bash /root/setup-selfhosted-supabase.sh
```

Logs: `/var/log/supabase-bootstrap.log`.

### Point the VMS frontend at the new instance

After the stack is up, grab `ANON_KEY` from
`/opt/Ramky_Applications/DEV/supabase/.env.secrets`, then rebuild the
React app with:

```
VITE_SUPABASE_URL=http://10.200.1.7:8000
VITE_SUPABASE_PUBLISHABLE_KEY=<ANON_KEY>
```

> Moving fully off Lovable Cloud also requires migrating schema, RLS
> policies, edge functions, and storage to this self-hosted instance —
> that's a separate task.
