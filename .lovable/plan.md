## What is happening

The current error is different from the earlier RLS issue. Now the form is authenticated, but the saved vendor row is using a `user_id` that the database cannot match in the auth users table, so the database rejects the save with:

`insert or update on table "vendors" violates foreign key constraint "vendors_user_id_fkey"`

This also explains why document uploads/data entry show failures: document upload runs after the vendor draft is created/updated, so if vendor save fails first, document metadata and autosave cannot complete.

## Fix plan

1. **Harden session resolution before vendor save**
   - In `src/hooks/useVendorRegistration.tsx`, use a single helper that calls `getUser()` after session refresh, not only `getSession()`.
   - This ensures the app saves the real verified auth user id, not a stale/invalid local session id.
   - If no valid user exists, stop saving and redirect back to the invitation login flow with a clear session-expired message.

2. **Handle foreign-key save errors cleanly**
   - Detect `vendors_user_id_fkey` failures in save/submit errors.
   - Show a clear message like: “Your login session is invalid. Please reopen the invitation link and sign in again.”
   - Redirect to `/vendor/invite?token=...` instead of letting the user continue filling a form that cannot save.

3. **Fix invitation auto-login consistency**
   - In `supabase/functions/accept-vendor-invite/index.ts`, return the generated auth user id from the invite acceptance function.
   - If needed, ensure the invitation’s `user_id` is linked to the auth user created/found for that invited email.
   - This keeps invitation, authenticated user, and vendor record aligned.

4. **Backend safety repair for this failed invitation/data**
   - Add a small database migration/function adjustment if needed so invitation claiming safely links the invitation to the authenticated user.
   - No table deletion or broad data cleanup unless you explicitly ask; this only repairs the broken invitation/user link.

5. **Verify**
   - Confirm the invitation email has an auth user.
   - Confirm the invitation token maps to the same user.
   - Confirm vendor save/submit will use that user id and the assigned buyer company id.

## Technical notes

- I will not change the buyer company logic.
- I will not delete existing vendor/invitation data unless you separately confirm that cleanup.
- This is a targeted fix for vendor draft save, document upload save, and final submit failure.