# Fix two server-side issues

## 1. "crypto.randomUUID is not a function" on Create Invitation

**Cause:** The server is served over plain HTTP (`http://10.200.1.7/...`). Browsers only expose `crypto.randomUUID()` in **secure contexts** (HTTPS or `localhost`). On HTTP, the call throws — which is exactly the error shown in the toast.

**Fix:** Add a small UUID helper that falls back when `crypto.randomUUID` is unavailable, and use it in `src/pages/AdminInvitations.tsx` (line 140) wherever `crypto.randomUUID()` is called.

```ts
// src/lib/uuid.ts
export function safeUUID(): string {
  if (typeof crypto !== 'undefined' && typeof crypto.randomUUID === 'function') {
    return crypto.randomUUID();
  }
  // RFC4122 v4 fallback using crypto.getRandomValues if available
  const bytes = new Uint8Array(16);
  (crypto?.getRandomValues?.(bytes)) ?? bytes.forEach((_, i) => (bytes[i] = Math.floor(Math.random() * 256)));
  bytes[6] = (bytes[6] & 0x0f) | 0x40;
  bytes[8] = (bytes[8] & 0x3f) | 0x80;
  const h = Array.from(bytes, b => b.toString(16).padStart(2, '0'));
  return `${h.slice(0,4).join('')}-${h.slice(4,6).join('')}-${h.slice(6,8).join('')}-${h.slice(8,10).join('')}-${h.slice(10,16).join('')}`;
}
```

Replace `const token = crypto.randomUUID();` in `AdminInvitations.tsx` with `safeUUID()`. (Recommend later moving the site behind HTTPS, but this unblocks today.)

## 2. Users created by Sharvi Admin not visible to tenant Admin

**Cause:** Current RLS lets `admin` and `sharvi_admin` read all `profiles`, `user_roles`, `user_tenants`, `user_custom_roles`, `custom_roles`. The fact that screenshot 2 (logged in as **Admin / admin@gmail.com**) shows only the admin's own row means the **server database does not have the latest RLS policies applied** — only the "own row" policies are evaluating to true.

Verified current cloud-DB policies are correct:
- `profiles`: "Admins can view all profiles" → `has_role(uid,'sharvi_admin') OR has_role(uid,'admin')`
- `user_roles`: "Admins can view all user roles" → same
- `user_tenants`: "Admins can read all user tenants" → same
- `user_custom_roles` / `custom_roles`: same

**Fix:** Ship a single idempotent migration that drops + re-creates these four admin-read policies, so when the self-hosted server runs migrations the gap is filled. No schema change, RLS-only.

```sql
-- profiles
DROP POLICY IF EXISTS "Admins can view all profiles" ON public.profiles;
CREATE POLICY "Admins can view all profiles" ON public.profiles
  FOR SELECT USING (
    public.has_role(auth.uid(),'sharvi_admin'::app_role)
    OR public.has_role(auth.uid(),'admin'::app_role)
    OR id = auth.uid()
  );

-- user_roles
DROP POLICY IF EXISTS "Admins can view all user roles" ON public.user_roles;
CREATE POLICY "Admins can view all user roles" ON public.user_roles
  FOR SELECT USING (
    public.has_role(auth.uid(),'sharvi_admin'::app_role)
    OR public.has_role(auth.uid(),'admin'::app_role)
    OR user_id = auth.uid()
  );

-- user_tenants
DROP POLICY IF EXISTS "Admins can read all user tenants" ON public.user_tenants;
CREATE POLICY "Admins can read all user tenants" ON public.user_tenants
  FOR SELECT USING (
    public.has_role(auth.uid(),'admin'::app_role)
    OR public.has_role(auth.uid(),'sharvi_admin'::app_role)
    OR user_id = auth.uid()
  );

-- user_custom_roles
DROP POLICY IF EXISTS "Users can view own custom role assignments" ON public.user_custom_roles;
CREATE POLICY "Users can view own custom role assignments" ON public.user_custom_roles
  FOR SELECT USING (
    user_id = auth.uid()
    OR public.has_role(auth.uid(),'sharvi_admin'::app_role)
    OR public.has_role(auth.uid(),'admin'::app_role)
  );
```

After deploying, re-run the migration step of the self-host deploy script on the server so these policies are applied to the on-prem Postgres.

## Files touched
- **New:** `src/lib/uuid.ts`
- **Edit:** `src/pages/AdminInvitations.tsx` — replace `crypto.randomUUID()` with `safeUUID()`
- **Migration:** re-assert the four admin-read RLS policies above

## Out of scope
- Switching the server to HTTPS (recommended separately).
- The User Management tabs (Users / Custom Roles / Role Permissions) are already gated by the same admin/sharvi_admin RLS — once the migration above is applied, all admins with read access will see the full dataset.
