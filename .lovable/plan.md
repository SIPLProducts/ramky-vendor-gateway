

## Fix: Custom-role users (e.g. SCM Head) can't see the sidebar

### Root cause

In `src/components/layout/AppLayout.tsx`, the sidebar is shown only when the **built-in** role is `sharvi_admin` or `admin`:

```ts
const adminRoles = ['sharvi_admin', 'admin'];
const isAdminRole = adminRoles.includes(role);
```

Users assigned a **custom role** (SCM Head, SCM Manager, Buyer, Finance Approval, Admin custom-role, etc.) keep the default base role `vendor`. So `isAdminRole` is `false` → sidebar is never rendered → they land in the vendor layout with no navigation, even though their custom-role screen permissions exist in the database (verified: SCM Head has 6 screens granted).

The `Sidebar` component already filters nav items via `useScreenPermissions()`, which correctly merges built-in + custom-role + approver-matrix permissions. The problem is purely that the sidebar wrapper never mounts for these users.

### What we'll change

Single file: **`src/components/layout/AppLayout.tsx`**

1. Pull screen permissions via `useScreenPermissions()` inside `AppLayout`.
2. Treat a user as "portal user" (gets sidebar) if **any** of:
   - built-in role is `sharvi_admin` / `admin` / `customer_admin` / `finance` / `purchase` / `approver`, OR
   - they have **any** screen permission granted (custom role or approver-matrix entry).
3. Only fall through to the vendor layout when the role is `vendor` AND no screen permissions are granted.
4. Wait for `permsLoading` before deciding, so the sidebar doesn't flash off for custom-role users on first load (matches the loading-guard pattern from the stack-overflow note).

### Resulting behavior

- SCM Head user → sidebar appears, showing exactly the 6 screens granted (Dashboard, SCM Approval, GST Compliance, All Vendors, Audit Logs, Vendor Invitations).
- Pure vendor users → unchanged, still get the vendor layout (no sidebar).
- Sharvi admin / admin → unchanged.
- Mobile layout condition updated to use the same "portal user" check so mobile header + bottom nav also appear for custom-role users.

### Files edited

- `src/components/layout/AppLayout.tsx` — broaden sidebar visibility check to include custom-role users with screen permissions.

No DB, RLS, edge function, or `Sidebar.tsx` changes needed — the existing permission filter inside the sidebar already does the right thing.

