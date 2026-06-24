## Goal
Make `/` (and refresh on any unauthenticated route) land directly on the Sign-in page instead of the Landing marketing page.

## Change
In `src/App.tsx`:
- Replace `<Route path="/" element={<Landing />} />` with `<Route path="/" element={<Navigate to="/auth" replace />} />`.
- Remove the now-unused `Landing` import.

## Notes
- Authenticated users land on `/dashboard` after login (existing `ProtectedRoute` behavior unchanged).
- On refresh, the root URL `/` will redirect to `/auth`, so unauthenticated sessions always see the login form.
- No other routes or auth/session logic are touched.