
## Plan: Configurable Custom Roles

Admin / Sharvi Admin can create their own roles (e.g. "Regional Approver"), define which screens each role can access, and assign them to users. Built-in roles (vendor, finance, etc.) stay untouched — custom roles are screen-access only.

### Database (new migration)

```sql
-- Admin-defined roles
CREATE TABLE public.custom_roles (
  id uuid PK, name text UNIQUE NOT NULL, description text,
  is_active boolean DEFAULT true, created_by uuid,
  created_at, updated_at
);

-- Screen permissions per custom role
CREATE TABLE public.custom_role_screen_permissions (
  id uuid PK,
  custom_role_id uuid REFERENCES custom_roles ON DELETE CASCADE,
  screen_key text NOT NULL,
  can_access boolean DEFAULT false,
  UNIQUE(custom_role_id, screen_key)
);

-- User ↔ custom role (a user can have many)
CREATE TABLE public.user_custom_roles (
  id uuid PK, user_id uuid NOT NULL,
  custom_role_id uuid REFERENCES custom_roles ON DELETE CASCADE,
  assigned_by uuid, assigned_at timestamptz DEFAULT now(),
  UNIQUE(user_id, custom_role_id)
);

-- RLS: admin/sharvi_admin manage; all authenticated read (sidebar needs it)
```

### UI

**1. New page `/admin/custom-roles`** (sidebar link, admin/sharvi_admin only)
- Table of custom roles: name, description, # users, status, actions
- "Create Role" dialog (name + description)
- Click a role → screen-permissions matrix (checkbox per screen, save inline)
- Edit / toggle active / delete (delete blocked if users assigned)

**2. `ChangeRoleDialog` (existing)** — add a "Custom Roles" multi-select below the built-in role dropdown, saves to `user_custom_roles`.

**3. `CreateUserDialog` (existing)** — same custom-role multi-select.

**4. `UserManagement.tsx`** — show assigned custom-role badges in each user row.

**5. `useScreenPermissions` hook** — union built-in role permissions with all custom-role permissions assigned to the user. Sidebar shows a screen if ANY assigned role grants it.

**6. `admin-create-user` edge function** — accept `custom_role_ids[]` and insert into `user_custom_roles`.

### Files

**New**
- `supabase/migrations/...` (3 tables + RLS + audit triggers)
- `src/pages/CustomRoles.tsx`
- `src/components/admin/CustomRoleDialog.tsx` (create/edit)
- `src/components/admin/CustomRolePermissionsMatrix.tsx`

**Modified**
- `src/hooks/useScreenPermissions.tsx`
- `src/components/admin/ChangeRoleDialog.tsx`
- `src/components/admin/CreateUserDialog.tsx`
- `src/pages/UserManagement.tsx`
- `src/components/layout/Sidebar.tsx`
- `src/App.tsx`
- `supabase/functions/admin-create-user/index.ts`

### Safeguards
- Delete blocked if users assigned (must unassign first)
- Audit log entries for create/delete/permission-change/assign/unassign
- Built-in roles & RLS untouched — zero risk to existing access control

### Out of scope
- Custom roles controlling data RLS (screen-only, as agreed)
- Per-tenant custom roles
- Role import/export
