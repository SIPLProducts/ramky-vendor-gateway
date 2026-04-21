

## Fix: Custom-role users routed correctly without altering custom role behavior

### Goal
When a Customer Admin creates a user with a **Custom Role** (e.g. "SCM Head"), the custom role itself must remain the source of truth for screen access — no built-in role should override or shadow it. Today, such users are silently stamped as `vendor` in `user_roles`, which sends them into the vendor portal on login.

### Root cause (recap)
- `user_roles.role` is a NOT-NULL enum, so every user must carry one built-in role.
- `CreateUserDialog.tsx` falls back to `'vendor'` for custom-role selections → routing layer reads `vendor` and pushes them to the vendor portal.
- `useAuth` only reads `user_roles`, so it never knows the user actually has a custom role.

### Fix (no built-in role used for custom-role users)

**1. `CreateUserDialog.tsx` — neutral placeholder, not a functional built-in role**
- When a Custom Role is picked, store `'approver'` in `user_roles` purely as a non-vendor placeholder. **No built-in permissions are granted** because:
  - `approver` has no rows in `role_screen_permissions` (verified — screen access today comes entirely from `custom_role_screen_permissions` for these users).
  - Routing/sidebar will be updated (step 3) to ignore the built-in role for custom-role users.
- The UI continues to show the user's *custom* role label everywhere — the enum value is internal plumbing only.

**2. `useAuth.tsx` — make custom roles first-class**
- After fetching `user_roles`, also fetch active `user_custom_roles` joined with `custom_roles` (id, name, is_active).
- Expose:
  - `customRoles: { id, name }[]` — only active ones.
  - `hasCustomRole: boolean`.
  - `isVendor: boolean` = `userRole === 'vendor' && !hasCustomRole`.
- Existing `userRole` field is preserved for backward-compat, but routing should prefer `isVendor` / `hasCustomRole`.

**3. Routing & layout — defer to custom role when present**
- `Auth.tsx` post-login redirect: if `hasCustomRole` → go to `/dashboard`; else if `isVendor` → vendor portal; else → `/dashboard`.
- `AppLayout.tsx`: treat `hasCustomRole` users as portal users (sidebar shown, vendor-only padding skipped). `useScreenPermissions` already merges custom-role screens, so the sidebar will list exactly what the custom role grants — nothing from any built-in role.
- `ProtectedRoute.tsx` stays as-is (auth gate only).

**4. One-time data backfill (existing mis-classified users like Brijesh)**
- Update existing rows: any user that has at least one active `user_custom_roles` link but `user_roles.role = 'vendor'` → set `user_roles.role = 'approver'`. This rescues already-created users without changing their custom role assignments.

### Explicitly out of scope
- No change to vendor invitation flow — invited vendors keep `role = 'vendor'` via the `handle_new_user` trigger and the existing email-domain logic.
- No change to `custom_roles`, `custom_role_screen_permissions`, or `user_custom_roles` schema.
- No new built-in role and no edits to `role_screen_permissions` — built-in roles get **zero** added permissions because of this fix.
- No changes to other registration / OCR work.

### Files
- Edit `src/components/admin/CreateUserDialog.tsx` — change custom-role fallback from `'vendor'` → `'approver'` (placeholder only).
- Edit `src/hooks/useAuth.tsx` — load custom roles, expose `customRoles`, `hasCustomRole`, `isVendor`.
- Edit `src/pages/Auth.tsx` — use `isVendor` / `hasCustomRole` for post-login redirect.
- Edit `src/components/layout/AppLayout.tsx` — treat `hasCustomRole` users as portal users.
- Data fix via insert/update tool: `UPDATE user_roles SET role='approver' WHERE role='vendor' AND user_id IN (SELECT user_id FROM user_custom_roles uc JOIN custom_roles cr ON cr.id=uc.custom_role_id WHERE cr.is_active);`

