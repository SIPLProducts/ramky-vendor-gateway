## Fix mobile header "SA" avatar (top-right)

**Problem (mobile view)**
- Tapping the "SA" avatar doesn't log the user out / return to login.
- The avatar is cramped against the edge (no right padding) and low visibility on the light header.

**Changes — `src/components/layout/MobileHeader.tsx` only**

1. **Make avatar tap sign out directly**
   - Replace the `DropdownMenu` around the avatar with a plain `Button` that calls `onSignOut` (same handler already wired from `AppLayout` → `handleLogout` → `navigate('/auth')`).
   - Keep Settings / Help / Change Password reachable via the existing sidebar menu (they already live there); mobile header becomes: Tenant switcher · Bell · Avatar-as-Logout, matching the desktop Sidebar Logout icon pattern we added earlier.
   - Add `title="Sign out"` and `aria-label="Sign out"` for clarity.

2. **Spacing & visibility**
   - Add right padding to the header action row (`pr-2` on the container) so the avatar isn't flush to the screen edge.
   - Increase gap between Bell and Avatar (`gap-2`).
   - Improve avatar contrast: solid `bg-primary` with a subtle `ring-1 ring-primary/30` and `shadow-sm` so it stands out on the white header; keep initials in `text-primary-foreground font-semibold`.
   - Bump touch target to `h-10 w-10` (avatar stays `h-8 w-8`) for reliable tap on mobile.

**Out of scope**
- Desktop sidebar avatar/logout (already correct).
- Any auth/routing logic — `handleLogout` already navigates to `/auth`.
