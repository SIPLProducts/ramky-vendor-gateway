
## Plan: User Management Screen

Add an admin screen to manage application users — view all users, their roles, tenant assignments, and change roles.

### What gets built

**New page: `/admin/users`**
- Table of all users: name, email, current role, assigned tenant(s), created date
- Search by name/email
- Filter by role
- Per-row "Change Role" action → dropdown to reassign role (vendor / finance / purchase / approver / customer_admin / admin / sharvi_admin)
- Per-row "Assign Tenant" action → select tenant from dropdown
- Stats header: total users, count per role

**Sidebar entry**
- Add "User Management" item (Users icon) in `Sidebar.tsx` and `MobileBottomNav.tsx`
- Visible only to `admin` and `sharvi_admin` roles
- Placed between "Vendor Invitations" and "Vendor Registration"

### Backend changes

The `user_roles` and `user_tenants` tables currently block INSERT / UPDATE / DELETE — no policies exist for those operations. Need to add admin-only mutation policies:

**Migration**
```sql
-- Allow admins to insert/update/delete user_roles
CREATE POLICY "Admins can insert user roles" ON public.user_roles
  FOR INSERT TO authenticated
  WITH CHECK (has_role(auth.uid(), 'sharvi_admin') OR has_role(auth.uid(), 'admin'));

CREATE POLICY "Admins can update user roles" ON public.user_roles
  FOR UPDATE TO authenticated
  USING (has_role(auth.uid(), 'sharvi_admin') OR has_role(auth.uid(), 'admin'));

CREATE POLICY "Admins can delete user roles" ON public.user_roles
  FOR DELETE TO authenticated
  USING (has_role(auth.uid(), 'sharvi_admin') OR has_role(auth.uid(), 'admin'));
```

(`user_tenants` already has admin INSERT/UPDATE/DELETE via existing ALL policies.)

### Technical Details

**Files to create**
- `src/pages/UserManagement.tsx` — main screen with table, search, filters, role/tenant change dialogs
- `src/components/admin/ChangeRoleDialog.tsx` — dropdown + confirm
- `src/components/admin/AssignTenantDialog.tsx` — tenant select + confirm

**Files to modify**
- `src/App.tsx` — add `/admin/users` route inside `AppLayout`
- `src/components/layout/Sidebar.tsx` — add nav item with `UserCog` icon (roles: admin, sharvi_admin)
- `src/components/layout/MobileBottomNav.tsx` — add same item

**Data fetching**
- Join `profiles` + `user_roles` + `user_tenants` + `tenants` via Supabase queries
- Use existing RLS: admins can SELECT all profiles & user_roles already

**Safeguards**
- Prevent users from changing their own role (avoid self-lockout)
- Confirmation dialog before role change
- Toast notification on success/failure
- Audit log entry written to `audit_logs` for every role change

### Out of scope
- Creating new users (handled via Auth signup / Vendor Invitations)
- Deleting users from auth.users (requires service-role; can add later if needed)
- Bulk role assignment
