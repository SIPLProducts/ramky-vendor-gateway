# Why your server doesn't show the fix

The `CreateUserDialog` change is **frontend code**. On Lovable's preview it updates automatically, but your self-hosted server is serving a **pre-built `dist/`** from nginx — until you rebuild and redeploy that `dist/`, users keep seeing the old bundle.

Your repo already has a deploy script for exactly this (`scripts/lib/60-frontend.sh`).

---

## Part 1 — Redeploy the frontend on your server

Run on the self-hosted box (as the user that owns the repo):

```bash
cd /path/to/repo                       # the folder containing package.json
git pull                               # pull the latest code (CreateUserDialog fix etc.)

# Build with the same env the installer uses
npm ci || npm install
npm run build                          # produces ./dist

# Deploy to nginx web root (path used by your installer)
sudo rsync -a --delete ./dist/ /var/www/sharvi/dist/

# Force browser + nginx to drop the old bundle
sudo nginx -s reload
```

Then **hard-refresh** the browser (Ctrl+F5) or open in incognito — Vite hashes filenames so a normal refresh is usually enough, but service workers / browser cache can still serve the old `index.html`.

If you used the bundled installer, you can also re-run just the frontend step:

```bash
sudo bash scripts/deploy-vms-server.sh --only frontend
```

(Adjust the flag name to whatever your `deploy-vms-server.sh` exposes — the lib step is `60-frontend.sh`.)

### How to confirm the new code is live
1. Open the User Management → Create User dialog
2. Pick role **sharvi_admin** or **admin**
3. The Tenants section should now show the grey note *"Admin roles have global access — no tenant selection required."* instead of the red SAP error box.

If you still see the old UI after a hard refresh, nginx is serving a cached `index.html` — clear `/var/cache/nginx/` or check that `rsync --delete` actually overwrote `dist/`.

---

## Part 2 — Email Configuration not saving

You mentioned both tabs fail but didn't share the exact error. To fix this I need one of:

- The **error toast text** shown when you click Save on each tab, **or**
- The browser **Network tab** response for the failing request (status code + response body), **or**
- The edge function log:
  ```bash
  # on the self-hosted box
  docker logs supabase-edge-functions 2>&1 | grep -E "smtp-config-save|noreply" | tail -50
  ```

Likely culprits (will confirm once we see the error):

1. **`smtp-config-save` / no-reply edge function not deployed on your server.** Self-hosted Supabase doesn't auto-deploy functions like Lovable Cloud does. Fix:
   ```bash
   cd /path/to/repo
   supabase functions deploy smtp-config-save --no-verify-jwt
   supabase functions deploy smtp-config-test
   supabase functions deploy smtp-config-delete
   # plus any no-reply function name used by NoReplyEmailConfig
   ```
   Or re-run the installer's functions step (`40-functions.sh`).

2. **RLS / role check failing** — `smtp-config-save` requires the caller to have role `sharvi_admin`, `admin`, or `customer_admin` in `user_roles`. If your logged-in user only has `vendor`, save returns 403.

3. **Missing `SUPABASE_SERVICE_ROLE_KEY` env** in the edge-functions container — causes a generic 500.

---

## What I'll do next (after you approve)

1. Document the redeploy procedure inline in `DEPLOYMENT_WINDOWS.md` / `SELFHOST_LINUX_HTTP.md` so you don't have to ask again.
2. Once you paste the email-save error, patch the specific cause (deploy the function, fix role check, or whatever the log shows).

No code changes are required for Part 1 — it's purely a server-side rebuild. Part 2 is gated on the error you see.
