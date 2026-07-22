## Changes to `src/components/layout/Sidebar.tsx`

1. **Remove "Settings"** menu item from the user profile dropdown.
2. **Remove the role label** (`displayRole`) under the user name in both:
   - Sidebar footer (below name)
   - Dropdown menu header
3. **Remove "Help & Support"** from the navigation list.
4. **Add a Logout icon button** in the sidebar navigation area (in place of Help & Support). Clicking it calls the existing `handleLogout` which signs out and navigates to `/auth`.
   - Uses the existing `LogOut` icon.
   - Styled consistently with other nav items (with tooltip when collapsed).
   - Text color styled as destructive (red-tinted) to distinguish it.

No other functionality changes — Change Password and Sign Out in the dropdown remain intact.