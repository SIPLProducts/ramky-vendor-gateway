# Root cause (verified against the database)

I queried Sunil's account directly:

- `user_roles.role` = `approver` (placeholder assigned when the user was created with a custom role)
- `user_custom_roles` has SAP Team assigned
- `custom_roles` row for SAP Team has `tenant_id = NULL` (global)
- `custom_role_screen_permissions` for SAP Team has Dashboard, SAP Sync, Help & Support ticked

So the data is correct. The problem is **RLS on `custom_roles`**:

```
Users read own tenant custom roles:
  has_role(auth.uid(), 'sharvi_admin') OR has_role(auth.uid(), 'admin')
  OR (tenant_id IS NOT NULL AND user_belongs_to_tenant(auth.uid(), tenant_id))
```

Sunil is not an admin and the SAP Team row has `tenant_id = NULL`, so this policy **hides the row from him**. Both places that need it use `custom_roles!inner(...)` joins:

1. `useAuth.loadRoles` — join is filtered out → `customRoles` is `[]` → sidebar shows the fallback `roleLabels[userRole]` = "Approver", and `hasCustomRole` is false everywhere.
2. `useScreenPermissions` — `custom_role_screen_permissions ... custom_roles!inner(is_active)` is filtered out → none of SAP Team's 3 screens are merged. Because `customRoles` is empty, the `skipBuiltIn` guard from the previous fix doesn't trigger, so built-in `approver` permissions (SCM Approval, All Vendors, Vendor Invitations, Help & Support, etc.) leak in instead.

That single RLS gap explains both symptoms — wrong sidebar label *and* wrong screens — and it affects every user assigned a global custom role (Buyer, SCM Manager, SCM Head, Finance 1/2, CEO Office, SAP Team, Admin, Finance Approval).

# Fix

## 1. Add a SELECT policy on `public.custom_roles` for normal users

Migration: add a policy allowing any authenticated user to read **active** custom roles. Role names/IDs are not sensitive, and users already need them to know what they were assigned. Keep the existing policies untouched.

```sql
CREATE POLICY "Authenticated can read active custom roles"
ON public.custom_roles
FOR SELECT
TO authenticated
USING (is_active = true);
```

This unblocks the `!inner` joins in both hooks. No client code changes are needed for the core fix — the existing logic already does the right thing once it can see the row.

## 2. Small client cleanup (defensive)

`src/hooks/useScreenPermissions.tsx` — drop the `!inner(is_active)` join and instead filter by an explicit `custom_roles.is_active` check after a separate fetch. This way a future RLS tweak can't silently strip permissions again. Same idea for `useAuth.loadRoles` — fetch assignments first, then look up names with a plain `select('id,name').in('id', ids).eq('is_active', true)`.

## 3. Verify

After deploy, log in as Sunil:

1. Sidebar footer shows **SAP Team** (not Approver).
2. Sidebar items: only Dashboard, SAP Sync, Help & Support — nothing else.
3. Other custom-role users (Buyer, SCM Manager, etc.) similarly see only the screens ticked for their role in the matrix.

# Why not change the enum or the placeholder role?

The custom-roles system is already the intended mechanism. The bug is purely an RLS visibility gap on the global (`tenant_id IS NULL`) rows; fixing it end-to-end is a one-line policy plus a small defensive refactor.
