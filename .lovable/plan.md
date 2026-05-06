# Fix: Custom role "SAP Team" not respected

## Root cause

When a user is created with a custom role, the system stores **`approver`** in `user_roles` as a placeholder, then attaches the custom role (e.g. SAP Team) via `user_custom_roles`. Three problems flow from that:

1. **Sidebar shows "Approver"** — `Sidebar.tsx` renders `roleLabels[userRole]`, which only knows built-in roles, so the custom-role name is never used.
2. **Wrong screens are visible** — `useScreenPermissions` merges built-in role permissions **AND** custom role permissions. Because the user's built-in role is `approver`, every screen ticked for `approver` in the Role & Screen Permissions matrix is granted on top of the SAP Team permissions. That's why "SCM Approval", "All Vendors", etc. appear even though SAP Team only has Dashboard + SAP Sync ticked.
3. **"SAP Team" missing from Role Permissions matrix** — The row exists in `custom_roles` (id `e37fc0a5…`), but the matrix table scrolls horizontally past several built-ins; with 7 built-ins + 9 custom columns it gets pushed off-screen. It is loaded but not visible without scrolling, and the column header layout doesn't make custom roles easy to find.

## Changes

### 1. Sidebar — show custom role name when present
`src/components/layout/Sidebar.tsx`
- Accept an optional `customRoleName` prop (or read `customRoles[0]?.name` directly via `useAuth`).
- When the user has a custom role, render that name instead of `roleLabels[userRole]` in both the collapsed footer (line 266) and dropdown header (line 293).

`src/components/layout/AppLayout.tsx`
- Pass the first custom role name to `<Sidebar>` (and to `MobileBottomNav` / `MobileHeader` if they show role labels).

### 2. Stop built-in `approver` perms from leaking to custom-role users
`src/hooks/useScreenPermissions.tsx`
- When the user has at least one active custom role AND their built-in role is the placeholder `approver`, skip step 1 (built-in role permission lookup) entirely. The custom role becomes the sole source of allowed screens. The "My Approvals" rule (step 3) stays unchanged so genuine approvers still see that screen.
- Result: a SAP Team user sees only the screens ticked under SAP Team's custom-role permissions — exactly what the matrix shows.

### 3. Role Permissions matrix — make custom roles easy to find
`src/pages/RolePermissions.tsx`
- Group columns: render Built-in roles first (already done), then a visually separated block of Custom roles with a sticky sub-header label.
- Add a small "Jump to" pill bar above the table listing each custom role name; clicking scrolls the table horizontally to that column.
- No data change — all 9 custom roles (including SAP Team) are already loaded; this just helps users find them.

### 4. (Optional polish) Users page
`src/pages/UserManagement.tsx`
- Already updated to show the custom role name as the primary badge — verify it picks up SAP Team correctly after the changes above.

## Why not add `sap_team` to the `app_role` enum?

It would require rewriting dozens of RLS policies and `has_role(...)` checks. The custom-roles system already exists for exactly this purpose; the bugs above are what stopped it from working end-to-end.

## Verification after deploy

1. Log in as the SAP Team user → sidebar footer shows "SAP Team" (not "Approver").
2. Sidebar shows only Dashboard + SAP Sync (the two screens currently ticked for SAP Team in the matrix).
3. Open Role Permissions → SAP Team column is visible (scroll/jump-to) and toggling its checkboxes adds/removes screens for that user on next login.
