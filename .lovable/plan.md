## Make base URL route to login

1. **`src/App.tsx`** — Change the `/` route to redirect to `/auth` (using `<Navigate to="/auth" replace />`). Remove the Landing page from `/`.

2. **`src/pages/Auth.tsx`** — Keep as-is: normal buyer/admin email+password login. Keep the existing safety guard that signs out any vendor account attempting to log in here and shows the "vendors must use invitation link or /vendor/login" message.

3. **No other changes** — `/vendor/login` untouched. No backend, schema, RLS, edge function, or email changes. Landing page file remains but is no longer routed (can be deleted later if desired).

4. **Validation** — Visit `/` → redirects to `/auth` (normal login form visible). Visit `/auth` directly → same login form. Vendor signing in on `/auth` → signed out with message. Run `tsgo --noEmit`.