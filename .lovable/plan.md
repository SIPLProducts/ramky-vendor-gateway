# Self-Hosted Supabase Bootstrap Script

Create a single idempotent bash script at `scripts/setup-selfhosted-supabase.sh` (in this repo) that the user can `scp` to the server and run with `sudo bash setup-selfhosted-supabase.sh`. Target layout:

```
/opt/Ramky_Applications/DEV/supabase/   # the cloned supabase/docker stack lives here
```

Host: **10.200.1.7** · Ports: Studio `3000`, Kong API `8000`, Postgres `5432`.

## What the script does (in order)

1. **Preflight**
   - Require root (`EUID == 0`), Ubuntu (`/etc/os-release`).
   - Verify `/opt/Ramky_Applications/DEV/supabase` parent exists; create if missing.
   - Log everything to `/var/log/supabase-bootstrap.log`.

2. **Install Docker + Compose plugin** (skip if `docker` + `docker compose version` already work)
   - `apt-get update`, install `ca-certificates curl gnupg jq openssl git ufw`.
   - Add Docker apt repo, install `docker-ce docker-ce-cli containerd.io docker-buildx-plugin docker-compose-plugin`.
   - `systemctl enable --now docker`.

3. **Clone Supabase stack** into `/opt/Ramky_Applications/DEV/supabase`
   - If `docker-compose.yml` already present → skip clone.
   - Else `git clone --depth 1 https://github.com/supabase/supabase /tmp/supabase-src` and `rsync -a /tmp/supabase-src/docker/ /opt/Ramky_Applications/DEV/supabase/`.

4. **Generate secrets** (only if `.env.secrets` does not exist — keeps re-runs safe)
   - `POSTGRES_PASSWORD` = 32-char base64
   - `JWT_SECRET` = 64-char hex
   - `DASHBOARD_USERNAME` = `supabase`, `DASHBOARD_PASSWORD` = 24-char base64
   - `SECRET_KEY_BASE`, `VAULT_ENC_KEY` = 64-char hex / 32-char base64
   - `ANON_KEY` and `SERVICE_ROLE_KEY` minted by signing standard Supabase JWT payloads (role=anon / service_role, 10-year expiry) with `JWT_SECRET` using a tiny inline Python `hmac+base64url` snippet (no extra deps).
   - Write all to `/opt/Ramky_Applications/DEV/supabase/.env.secrets` with `chmod 600`.

5. **Write `.env`** from `.env.example`
   - Substitute all generated secrets.
   - Set:
     - `SITE_URL=http://10.200.1.7:3000`
     - `API_EXTERNAL_URL=http://10.200.1.7:8000`
     - `SUPABASE_PUBLIC_URL=http://10.200.1.7:8000`
     - `STUDIO_DEFAULT_ORGANIZATION=Sharvi`, `STUDIO_DEFAULT_PROJECT=VMS-DEV`
     - `KONG_HTTP_PORT=8000`, `STUDIO_PORT=3000`, `POSTGRES_PORT=5432`
     - `ENABLE_EMAIL_SIGNUP=true`, `ENABLE_EMAIL_AUTOCONFIRM=false`
   - Keep the original `.env.example` untouched.

6. **Firewall** (only if `ufw` is active)
   - Allow `22, 80, 3000, 8000` from anywhere; leave `5432` closed by default (note in summary).

7. **Bring stack up**
   - `cd /opt/Ramky_Applications/DEV/supabase && docker compose pull && docker compose up -d`.
   - Poll `http://127.0.0.1:8000/` for up to 120s.

8. **Print summary**
   - Studio URL, API URL, anon key (full), service role key (masked, full value in `.env.secrets`), dashboard user/pass, log file path, useful commands (`docker compose ps`, `logs -f`, `down`).

## Re-run / safety behavior

- Clone step skipped if stack exists.
- Secret generation skipped if `.env.secrets` exists; `.env` is regenerated from `.env.secrets` each run so manual edits to `.env` outside the managed block are preserved via a clearly-delimited `# >>> managed by setup-selfhosted-supabase.sh` block.
- Script uses `set -Eeuo pipefail` and a `trap` that prints the failing line and tails the log on error.

## Technical details

- **JWT minting** (anon + service role) done with inline `python3 -c` using only stdlib (`hmac`, `hashlib`, `base64`, `json`, `time`). Falls back to printing instructions if `python3` missing (Ubuntu 22.04 ships it).
- **Compose file**: uses the upstream `docker-compose.yml` shipped by `supabase/supabase/docker` — no fork, no edits.
- **No SSL / no Nginx** in this script (matches user choice). A follow-up Nginx vhost can be added later under `/opt/Ramky_Applications/nginx`.
- **No app changes**: this is a server-side ops script only. No edits to the VMS React app, edge functions, or `src/integrations/supabase/client.ts`.

## Deliverable

One new file in the repo:

- `scripts/setup-selfhosted-supabase.sh` — executable (`chmod +x`), ~250 lines, fully self-contained.

Plus a short `scripts/README.md` section explaining: copy to server, `sudo bash setup-selfhosted-supabase.sh`, where secrets land, how to point the VMS frontend at the new instance (`VITE_SUPABASE_URL=http://10.200.1.7:8000`, `VITE_SUPABASE_PUBLISHABLE_KEY=<ANON_KEY>` then rebuild).
