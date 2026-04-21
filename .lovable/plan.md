
## Plan: Create Users + Role/Screen/Tenant Assignment in User Management

Add full user lifecycle management to the existing `/admin/users` screen.

### What gets built

**1. "Create User" button (top-right of User Management page)**
- Opens dialog with: Full Name, Email, Password (auto-generate option), Role (dropdown), Tenant (multi-select, optional)
- Calls a new edge function `admin-create-user` (uses service-role key to bypass signup confirmation and create user instantly)
- On success: profile + role + tenant assignments are written, toast shown, table refreshed

**2. Role → Screen access mapping (new screen)**
- New page: `/admin/role-permissions`
- Shows a matrix: rows = roles (vendor, finance, purchase, approver, customer_admin, admin, sharvi_admin), columns = screens (Dashboard, Vendor List, Finance Review, Purchase Approval, SAP Sync, GST Compliance, Document Verification, Audit Logs, User Management, Admin Configuration, Sharvi Admin Console, Vendor Invitations, Scheduled Checks)
- Checkbox per cell — toggling persists to a new `role_screen_permissions` table
- Sidebar dynamically reads these permissions to decide which links to show (replaces current hard-coded role arrays)

**3. Enhanced Role Assignment (existing dialog upgrade)**
- `ChangeRoleDialog` already exists — extend it to also show & manage tenant assignments inline (instead of separate `AssignTenantDialog`)
- Single dialog: pick role + check/uncheck tenants in one place
- Keep `AssignTenantDialog` for the standalone "Tenants" column action as well

### Backend changes

**Migration**
```sql
-- New table for role-based screen permissions
CREATE TABLE public.role_screen_permissions (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  role app_role NOT NULL,
  screen_key text NOT NULL,
  can_access boolean NOT NULL DEFAULT false,
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now(),
  UNIQUE(role, screen_key)
);

ALTER TABLE public.role_screen_permissions ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Everyone can read role permissions"
  ON public.role_screen_permissions FOR SELECT TO authenticated USING (true);

CREATE POLICY "Admins manage role permissions"
  ON public.role_screen_permissions FOR ALL TO authenticated
  USING (has_role(auth.uid(), 'sharvi_admin') OR has_role(auth.uid(), 'admin'))
  WITH CHECK (has_role(auth.uid(), 'sharvi_admin') OR has_role(auth.uid(), 'admin'));

-- Seed sensible defaults (admin/sharvi_admin = all screens; others = role-appropriate)
INSERT INTO public.role_screen_permissions (role, screen_key, can_access) VALUES
  ('sharvi_admin','dashboard',true),('sharvi_admin','vendors',true), ... (full matrix)
  ('admin','dashboard',true), ...
  ('finance','dashboard',true),('finance','vendors',true),('finance','finance_review',true),('finance','audit_logs',true),
  ('purchase','dashboard',true),('purchase','vendors',true),('purchase','purchase_approval',true),
  ('vendor','vendor_registration',true),('vendor','vendor_feedback',true)
  ON CONFLICT (role, screen_key) DO NOTHING;
```

**New edge function: `admin-create-user`**
- Verifies caller is admin/sharvi_admin
- Uses service-role client → `supabase.auth.admin.createUser({ email, password, email_confirm: true, user_metadata: { full_name } })`
- Inserts into `user_roles` (role) and `user_tenants` (selected tenants)
- Returns the new user id

`supabase/config.toml` will get a block for the new function with `verify_jwt = true` (we need the caller's JWT to verify they're an admin).

### Files

**New**
- `src/pages/RolePermissions.tsx` — matrix UI
- `src/components/admin/CreateUserDialog.tsx` — create user form
- `supabase/functions/admin-create-user/index.ts` — edge function

**Modified**
- `src/pages/UserManagement.tsx` — add "Create User" button + dialog
- `src/components/admin/ChangeRoleDialog.tsx` — add tenant multi-select section
- `src/components/layout/Sidebar.tsx` — replace hard-coded role arrays with dynamic lookup against `role_screen_permissions`
- `src/components/layout/MobileBottomNav.tsx` — same dynamic lookup
- `src/App.tsx` — register `/admin/role-permissions` route
- `supabase/config.toml` — register `admin-create-user` function

### Safeguards
- Caller-side: only `admin` / `sharvi_admin` see the Create User button and Role Permissions page
- Server-side: edge function double-checks caller role before using service-role
- Cannot delete `sharvi_admin` access to `role_permissions` screen (prevents lockout)
- Audit log entry written for: user created, role changed, screen permission toggled

### Out of scope
- Deleting users (can add later)
- Custom screens beyond the existing app pages
- Per-tenant screen permissions (this is global per role)
