## Problem

The sidebar item **Buyer Approval** (`/approvals/buyer`) is currently gated using the `vendor_invitations` screen key (see `src/components/layout/Sidebar.tsx:70`). There is no dedicated entry in **User Management → Role Permissions**, so admins cannot grant or revoke Buyer Approval independently of Vendor Invitations. This is effectively hardcoded.

## Goal

Expose **Buyer Approval** as its own screen in the Role Permissions matrix so access is controlled per role (built-in and custom) like every other approval screen — without changing any other functionality.

## Changes

### 1. Add the screen key in the permissions registry
`src/pages/RolePermissions.tsx` — add to `SCREENS`, grouped with the other approval entries:
```
{ key: 'buyer_approval', label: 'Buyer Approval' },
```
Place it just above `scm_manager_approval` so the matrix lists approvals in flow order: Buyer → SCM Manager → SCM Head → Finance 1 → Finance 2 → CEO.

### 2. Use the new key in the sidebar
`src/components/layout/Sidebar.tsx:70` — change the Buyer Approval item from:
```
screenKey: 'vendor_invitations'
```
to:
```
screenKey: 'buyer_approval'
```
No other sidebar items change.

### 3. Seed sensible defaults (data migration via insert tool)
So existing buyer users do not lose access the moment we deploy, insert default `role_screen_permissions` rows (tenant_id = NULL, global default) granting `buyer_approval = true` for the same built-in roles that today see the link via the old key:
- `sharvi_admin`
- `admin`
- `customer_admin`
- `purchase` (the "buyer" role in this app)
- `approver`

`vendor`, `finance` remain false. Custom roles get nothing seeded — admins tick the new column when needed.

No SQL schema change is required (`role_screen_permissions` already stores arbitrary `screen_key` text), so this is a data-only insert, not a migration.

### 4. Backward compatibility
- The existing `vendor_invitations` permission is left untouched and continues to gate the Vendor Invitations page only.
- `useScreenPermissions` already reads from `role_screen_permissions` / `custom_role_screen_permissions` by key, so no hook changes are needed.
- The page component `BuyerApproval.tsx`, route registration, and approval workflow logic are not modified.

## Files touched

- `src/pages/RolePermissions.tsx` — add one entry to `SCREENS`
- `src/components/layout/Sidebar.tsx` — change one `screenKey` value
- Data-only insert into `role_screen_permissions` for the five default-allow roles

## Out of scope

- No changes to `seed_vendor_approval_progress`, approval workflow, custom-roles UI, or other approval screens.
- No removal of the `vendor_invitations` entry — Vendor Invitations remains its own screen.
