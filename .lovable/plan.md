## Correct target: top navigation bar (`EnterpriseHeader`), not the sidebar

### 1. `src/components/layout/EnterpriseHeader.tsx`
- Remove the entire "Help & Support" dropdown block (the `HelpCircle` button with Help Center/email/phone menu).
- In its place, add a **Logout icon button** (using `LogOut` from lucide-react) that:
  - On click, calls `supabase.auth.signOut()` (via `useAuth().signOut`) and navigates to `/auth`.
  - Shows a tooltip "Logout" on hover.

### 2. `src/components/layout/Sidebar.tsx`
- Revert the Logout button that was just added to the sidebar navigation (restore the nav to end with just the mapped items).
- Keep the earlier changes intact: Settings menu item removed, role label removed.

No other files or functionality affected.