## Status

Backend is up and healthy:
- All 13 Supabase containers running
- Kong reachable on `127.0.0.1:18000`
- Auth health via nginx returns valid GoTrue JSON (no more 502)

Pooler conflict is resolved. Login will fail right now only because (a) the frontend `dist/` may still point at Lovable Cloud, (b) migrations / edge functions may not be applied, and (c) no user exists yet.

## Remaining server steps

### 1. Apply migrations + sync edge functions + middleware

```bash
cd /opt/Ramky_Applications/DEV/VMS/source
sudo bash scripts/deploy-vms-server.sh \
  --skip-docker --skip-build --skip-nginx
```

This runs `30-migrations.sh`, `40-functions.sh`, `50-middleware.sh` against the now-healthy stack. Re-runs are safe (migrations tracked in `public._applied_migrations`).

### 2. Rebuild frontend against the self-hosted backend

```bash
cd /opt/Ramky_Applications/DEV/VMS/source
sudo bash scripts/deploy-vms-server.sh \
  --skip-docker --skip-migrations --skip-functions --skip-middleware --skip-nginx
```

This writes `.env.production` with:
```
VITE_SUPABASE_URL=http://10.200.1.7/supabase
VITE_SUPABASE_PUBLISHABLE_KEY=<ANON_KEY from .env.secrets>
```
runs `npm ci && npm run build`, and `rsync`s `dist/` into `/opt/Ramky_Applications/DEV/VMS/frontend/dist/` (the nginx root).

After this completes:
```bash
curl -I http://10.200.1.7/
```
should return `200 OK` and serve the new SPA.

### 3. Create the first admin user

Open `http://10.200.1.7/studio/` — basic-auth credentials are in `/opt/Ramky_Applications/DEV/VMS/backend/.env.secrets`:
```bash
grep -E '^DASHBOARD_(USERNAME|PASSWORD)=' \
  /opt/Ramky_Applications/DEV/VMS/backend/.env.secrets
```

In Studio:
1. Authentication -> Users -> Add user -> create your admin email + password (tick "Auto Confirm User").
2. SQL Editor, run:
   ```sql
   insert into public.user_roles (user_id, role)
   values ('<paste-new-auth-user-uuid>', 'sharvi_admin');
   ```

Then open `http://10.200.1.7/` and sign in with that email + password.

### 4. (Optional) Edge function + middleware secrets

Only needed for the features that use them:

```bash
sudo nano /opt/Ramky_Applications/DEV/VMS/backend/.env
# add as needed:
# RESEND_API_KEY=...
# CASHFREE_CLIENT_ID=...
# CASHFREE_CLIENT_SECRET=...
# SAP_MIDDLEWARE_KEY=<must match middleware MIDDLEWARE_SHARED_SECRET>
docker compose -f /opt/Ramky_Applications/DEV/VMS/backend/docker-compose.yml \
  restart functions

sudo nano /opt/Ramky_Applications/DEV/VMS/middleware/.env
# set SAP_BP_API_URL / SAP_BP_USERNAME / SAP_BP_PASSWORD
sudo systemctl restart vms-middleware
```

Note: `LOVABLE_API_KEY` is hosted-only. Any edge function calling Lovable AI Gateway must be repointed to OpenAI / Gemini with your own key on self-host.

## If anything fails

Capture and paste:
```bash
docker compose -f /opt/Ramky_Applications/DEV/VMS/backend/docker-compose.yml ps
tail -n 100 /opt/Ramky_Applications/DEV/VMS/logs/deploy.log
```
plus the specific error from the step that failed.