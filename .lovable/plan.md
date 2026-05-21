# Fix tenants popover + multi-select Assign Tenant dialog

## Issues
1. **"159 tenants" chip does not open the popover.** The shadcn `Badge` is a plain `div` without `forwardRef`, so `PopoverTrigger asChild` fails to attach its ref/handlers and the click never opens the Radix popover.
2. **Assign Tenant dialog is single-select.** User wants a multi-select with Select All / Unselect All so multiple tenants can be added in one go.

## Changes

### 1. `src/pages/UserManagement.tsx` — make the chip a proper trigger
Replace the `<PopoverTrigger asChild><Badge …></PopoverTrigger>` with a real `<button type="button">` styled like the badge (same outline/hover classes). Keeps the icon + "N tenants" label; Radix will now wire click → open correctly.

### 2. `src/components/admin/AssignTenantDialog.tsx` — switch to multi-select
- Replace `Select` with the existing `MultiSelect` component (`@/components/ui/multi-select`) bound to `selectedIds: string[]`.
- Above the multi-select, add two compact text buttons: **Select all** (sets `selectedIds = available.map(t => t.id)`) and **Clear** (sets `selectedIds = []`). Show a small count `({selectedIds.length} / {available.length} selected)`.
- Change the `onConfirm` prop signature from `(tenantId: string) => Promise<void>` to `(tenantIds: string[]) => Promise<void>`.
- Save button disabled until at least one is selected; label becomes `Assign N tenant(s)`.

### 3. `src/pages/UserManagement.tsx` — bulk insert handler
Update `handleAssignTenant` to accept `tenantIds: string[]`:
- Build rows `tenantIds.map(tid => ({ user_id: tenantDialog.id, tenant_id: tid }))`.
- Single `supabase.from('user_tenants').insert(rows)`.
- Toast: `Assigned N tenant(s)`. Then `loadData()`.

## Out of scope
- No schema, RLS, or business-logic changes.
- No change to the Role dialog, Custom Roles column, or CreateUserDialog (already uses MultiSelect).

## Verification
In preview at `/admin/users`:
- Click the "159 tenants" chip → popover opens with the scrollable list and per-row × still removes.
- Click the row's **Tenant** button → dialog shows a multi-select; Select all picks every remaining tenant; assigning inserts them all and the chip count updates.
