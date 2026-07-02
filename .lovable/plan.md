# User Management — Active/Inactive Status, Login Blocking, Attempt Logging, Auto-Logout

## 1. Database (migration)

**Add columns to `profiles`:**
- `status text not null default 'active'` — values: `active` | `inactive`
- `last_login_attempt_at timestamptz` — timestamp of most recent login attempt (any status)

**New table `login_attempts`:**
- `id uuid pk`, `user_id uuid`, `email text`, `attempt_status text` (`success` | `inactive_user` | `invalid_credentials`), `attempted_at timestamptz default now()`, `ip text null`, `user_agent text null`
- RLS: admins/sharvi_admin/customer_admin can `select`; edge function (service role) inserts. Standard `GRANT` block.

**Helper RPC `check_user_active(_email text)`** (SECURITY DEFINER) — returns `{ status, user_id }` so the sign-in flow can look up status without needing a session.

## 2. Auth flow (`useAuth.signIn`)

Before `signInWithPassword`:
1. Call `check_user_active` RPC with email.
2. If `status = 'inactive'`:
   - Insert row in `login_attempts` (`attempt_status='inactive_user'`) via edge function `log-login-attempt` (service role).
   - Update `profiles.last_login_attempt_at`.
   - Return error: **"Your account is inactive. Please contact the Administrator to proceed."**
3. Otherwise proceed with sign-in; on result log `success` or `invalid_credentials` and update `last_login_attempt_at`.

New edge function `log-login-attempt` (public/no-verify-jwt, service role writes) — since inactive users won't have a session.

## 3. Auto-logout after 30 min inactivity

New hook `useIdleLogout(minutes=30)` mounted in `AuthProvider` (only when a session exists):
- Listens to `mousemove`, `keydown`, `click`, `scroll`, `touchstart`, `visibilitychange`.
- Resets a timer on any activity; on timeout calls `signOut()` and shows a toast "Signed out due to inactivity."
- Also tracks `localStorage` timestamp so cross-tab activity resets the timer.

## 4. User Management UI (`src/pages/UserManagement.tsx`)

**Table changes:**
- New column **Status** — `Active` / `Inactive` badge.
- New column **Last Login Attempt** — formatted date/time (or `—`).
- New **Edit** button (pencil icon) opens `EditUserDialog` with:
  - Full Name (text)
  - Status (Select: Active / Inactive)
  - Save → updates `profiles.full_name` and `profiles.status`; audit log entry.

**New "Inactive Login Attempts" panel** (collapsible card below the Users table):
- Fetches last 100 rows from `login_attempts` where `attempt_status='inactive_user'`.
- Columns: User Name, Login Attempt Date & Time, Login Status ("Inactive User"), Last Login Attempt (from `profiles.last_login_attempt_at`).

**Files:**
- `supabase/migrations/<ts>_user_status_and_login_attempts.sql` (new)
- `supabase/functions/log-login-attempt/index.ts` (new)
- `src/components/admin/EditUserDialog.tsx` (new)
- `src/hooks/useIdleLogout.tsx` (new)
- `src/hooks/useAuth.tsx` (edit `signIn`, mount idle logout)
- `src/pages/UserManagement.tsx` (columns, Edit button, load `status`/`last_login_attempt_at`, attempts panel)

## Notes / assumptions

- Existing users default to `active`.
- Auto-logout applies to **all** authenticated users (vendors + internal). Confirm if it should exclude vendors.
- "Login Status" in the attempts table always shows "Inactive User" since we're filtering to that case; the underlying table also stores success/invalid_credentials for future use.
