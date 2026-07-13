## Update Edit User & Replace User dialogs to use live SAP tenant fetch

Mirror the User Creation flow (email → `fetch-tenants-from-sap` edge function → live "Tenants From SAP" SAP API) inside the Edit User and Replace User dialogs. Tenant Access becomes read-only, sourced from SAP, instead of the local `tenants` checkbox list.

### 1. `src/components/admin/EditUserDialog.tsx`
- Add a **"Fetch"** button next to the (disabled) Email input.
- On click, call `supabase.functions.invoke('fetch-tenants-from-sap', { body: { email } })` — the same edge function CreateUserDialog uses, which hits the live SAP "Tenants From SAP" API configured in SAP API Settings. Always returns the latest SAP data.
- Replace the current Tenant Access checkbox list with a **read-only** panel showing the fetched tenants (code + name). States:
  - Before first fetch: show existing tenant names (from `user.tenantIds` mapped via `tenants` prop) with a hint "Click Fetch to refresh from SAP".
  - Loading spinner while the edge function runs.
  - Error message if the call fails.
  - Fetched list rendered read-only (no checkboxes).
- On Save:
  - If tenants were fetched in this session → send them to a new `admin-update-user` edge function (step 3) which upserts into `public.tenants` by code and rewrites `user_tenants` for this user.
  - If not fetched → keep current `tenantIds` untouched (user may open and close without refetching).
- Role editing behavior unchanged.

### 2. `src/components/admin/ReplaceUserDialog.tsx`
- Remove the "Tenants" line from the inactive-user summary card.
- After a Replacement User is selected, automatically invoke `fetch-tenants-from-sap` with the replacement user's email (same live SAP call).
- Render the returned tenants read-only under the dropdown as "Companies/Tenants for replacement (from SAP)". Loading + error states as above.
- Confirm button remains enabled once a replacement is picked; the fetch is informational. Server-side reassignment logic (`reassign-user-work`) is unchanged.

### 3. New edge function `supabase/functions/admin-update-user/index.ts`
Thin mirror of the tenant-upsert block already in `admin-create-user`:
- Input: `{ user_id, full_name, status, role, custom_role_ids, sap_tenants: [{code, name}] }`.
- Admin-only role gate (same as `admin-create-user`).
- Upserts `sap_tenants` into `public.tenants` by `code`, resolves IDs, replaces this user's `user_tenants` rows, updates `profiles` (full_name, status), replaces `user_roles`, replaces `user_custom_roles`.
- `UserManagement.handleSaveEditUser` calls this function only when `sap_tenants` are present; the existing direct-table update path stays as fallback so users who close without fetching are unaffected.

### Not changed
- `CreateUserDialog`, `admin-create-user`, `reassign-user-work` server logic, approval routing, notifications, SAP Sync, Dashboard.
- `public.tenants` remains the source of truth for `user_tenants.tenant_id`; SAP codes are upserted into it, not bypassed.
- Other tenant consumers (Tenant Manager, filters, Approval Matrix) unchanged.
