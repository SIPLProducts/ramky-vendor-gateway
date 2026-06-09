## Two small changes

### 1. Login screen — Forgot password link placement
On `src/pages/Auth.tsx`, the "Forgot password?" link currently planned above the Sign In button will instead be placed **below** the Sign In button (centered, small text link). Clicking it opens the existing `ForgotPasswordDialog`.

```text
[ Email          ]
[ Password       ]
[   Sign In →    ]
       Forgot password?
```

### 2. Reset Password page — success toaster
On `src/pages/ResetPassword.tsx`, after `supabase.auth.updateUser({ password })` succeeds:
- Show a sonner success toast: **"Password changed successfully"**
- Then sign the user out and redirect to `/auth` so they log in with the new password.

If the update fails, show an error toast with the returned message (existing inline error stays as well).

### Files touched
- `src/pages/Auth.tsx` — move the link below the Sign In button inside the login form.
- `src/pages/ResetPassword.tsx` — add `toast.success("Password changed successfully")` on successful update (import `toast` from `sonner`).

No backend, RLS, or edge function changes.
