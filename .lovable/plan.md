# Add Delete User to User Management

Add a Delete action to each row on the Users tab (`/admin/users`) that fully removes the user from auth and all related tables. Deletion requires admin privileges, so it must run through a new edge function (the client cannot call `auth.admin.deleteUser`).

## 1. New edge function: `admin-delete-user`

Mirrors `admin-create-user` for auth + permission checks.

- Accept POST with body `{ user_id: string }`.
- Verify caller via `Authorization` bearer; load `user_roles` and require `admin` or `sharvi_admin`.
- Block self-deletion: if `user_id === callerId` → 400 "You cannot delete your own account".
- Using the service-role client, in this order:
  1. `user_custom_roles` delete by `user_id`
  2. `user_tenants` delete by `user_id`
  3. `user_roles` delete by `user_id`
  4. `profiles` delete by `id` (in case no FK cascade)
  5. `admin.auth.admin.deleteUser(user_id)`
- Insert `audit_logs` row: `action: 'user_deleted'`, `user_id: callerId`, `details: { target_user_id, target_email }` (fetch email from `profiles` before delete for the audit detail).
- Return `{ ok: true }`. Standard CORS headers, same shape as `admin-create-user`.

No `supabase/config.toml` change needed (default JWT verification settings are fine; function reads its own auth header).

## 2. UI changes in `src/pages/UserManagement.tsx`

In the Users table actions cell (around line 428–438), add a third ghost button:

- `<Button variant="ghost" size="sm" className="text-destructive" disabled={u.id === user?.id} title={u.id === user?.id ? 'Cannot delete own account' : 'Delete user'} onClick={() => setDeleteUser(u)}><Trash2 className="h-4 w-4 mr-1" /> Delete</Button>`
- `Trash2` is already imported.

Add state: `const [deleteUser, setDeleteUser] = useState<UserRow | null>(null);` and `const [deleting, setDeleting] = useState(false);`.

Add an `AlertDialog` (import from `@/components/ui/alert-dialog`) at the bottom of the component:

- Title: "Delete user?"
- Description: ``This will permanently delete `${deleteUser?.email}` and remove all role, tenant and custom-role assignments. This action cannot be undone.``
- Cancel + Delete actions. Delete button uses destructive styling and shows a spinner while `deleting`.
- On confirm: call `supabase.functions.invoke('admin-delete-user', { body: { user_id: deleteUser.id } })`. On success, toast "User deleted", close dialog, `await loadData()`. On error, toast the message; keep dialog open.

## Out of scope

- No DB migrations (existing tables already support these deletes; nothing schema-level changes).
- No changes to `CreateUserDialog`, custom-roles tab, role-permissions tab, or approval-matrix tab.
- No bulk delete; single-user only for now.
