Plan:

1. Detect vendor accounts at sign-in
   - Vendors are identified by having the `vendor` role in `user_roles` (or by having a row in `vendors` linked to their auth user).
   - Add a small check that runs after any successful login on the generic Sign In screen (`/auth`).

2. Block vendors from the generic Sign In flow
   - If a user signs in on `/auth` and turns out to be a vendor, immediately sign them out and show an inline message:
     - "Vendors must use the invitation link sent by email, or the Vendor Login page."
     - Include a link/button to `/vendor/login`.
   - Buyers, admins, approvers, and finance users continue to sign in on `/auth` exactly as today.

3. Landing page guidance for vendors
   - Keep the current Landing page for buyers/admins.
   - Update the small helper text under the Sign In button so vendors know where to go:
     - "Vendor? Open your invitation email or go to Vendor Login."
   - No change to the Sign In button visibility (buyers/admins still need it).

4. Guard the vendor-only routes on refresh
   - `/vendor/registration` without `?token=` or `?onBehalfOf=` already shows Access Denied — keep as-is.
   - If an already-authenticated vendor lands on `/` or `/auth`, redirect them to `/vendor/login` (so they see the vendor-specific screen instead of the marketing landing).

5. No backend/schema changes
   - Purely client-side routing and login-guard changes.
   - No changes to invitation tokens, OCR, KYC, save/submit, or approval flow.

6. Validate
   - Vendor removes token and hits root domain → sees Landing with vendor helper text; if already signed in as a vendor → auto-redirected to `/vendor/login`.
   - Vendor tries to sign in via `/auth` → blocked with the message above and signed out.
   - Buyer/admin sign-in on `/auth` → works normally.
   - Vendor uses `/vendor/login` or their invitation link → works normally.
   - Run TypeScript check after implementation.