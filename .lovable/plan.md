# Add Change Password (Logged-In Users)

Add a "Change Password" entry under the user avatar dropdown in the app header. Opens a modal where the user enters and confirms a new password — no current-password check, per your choice.

## Scope

- In-app only (logged-in users).
- Reuses Lovable Cloud auth: `supabase.auth.updateUser({ password })`.
- No DB changes, no edge functions, no new routes.
- Forgot Password (logged-out reset flow) is **out of scope** for this round.

## UX

1. User clicks avatar in `EnterpriseHeader` (and `MobileHeader` for parity) → dropdown shows new item **"Change Password"** above "Sign Out".
2. Clicking opens a modal dialog titled **"Change Password"** with:
   - New Password (masked, show/hide toggle)
   - Confirm New Password (masked, show/hide toggle)
   - Inline strength hint
   - Buttons: **Cancel**, **Update Password** (disabled until valid)
3. On success: toast "Password changed successfully", close modal.
4. On failure: toast with the auth error message; keep modal open.

## Validation (client-side, zod)

- Min 8 chars
- At least one uppercase, one lowercase, one number
- New password === Confirm password
- Block submit while requirements unmet

## Technical Details

**New files**
- `src/components/account/ChangePasswordDialog.tsx` — controlled dialog using shadcn `Dialog`, `Input`, `Button`, `Label`; zod schema; `sonner` toasts; calls `supabase.auth.updateUser({ password })`.

**Edited files**
- `src/components/layout/EnterpriseHeader.tsx` — add "Change Password" `DropdownMenuItem` (Key icon) above Sign Out; local `open` state; render `<ChangePasswordDialog />`.
- `src/components/layout/MobileHeader.tsx` — same dropdown item for mobile parity (if a user menu exists there; otherwise skipped).

**Not changing**
- `useAuth`, routes, DB schema, edge functions, email config.

## Verification

- Log in → click avatar → "Change Password" visible.
- Submit with mismatched passwords → inline error, submit disabled.
- Submit weak password → inline error.
- Submit valid new password → success toast; sign out and sign back in with the new password works.
- Old password no longer works after change.
