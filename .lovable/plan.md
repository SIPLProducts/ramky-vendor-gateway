# Fix: "Could not find the function public.check_my_smtp_configured" on the self-hosted server

## What's happening
When you click **Create Invitation**, the app first checks whether your account has an active SMTP sender configured. It does that by calling a database function named `check_my_smtp_configured`.

That function exists in the project's migration files, but it has never been applied to the self-hosted database — so the database says "function not found" and the invitation is blocked. On Lovable Cloud it works because the migration ran there.

This is a deployment gap, not an app bug: nothing in the frontend needs to change.

## Fix
1. Apply the missing migration to the self-hosted database so the function is created with the correct permissions (`authenticated` may execute; anonymous may not).
2. Re-run the standard self-host migration step so any other migrations that were never applied get applied too, rather than patching just this one function.
3. Reload the API schema cache so the new function is visible immediately (otherwise the "schema cache" message can persist for a few minutes).
4. Verify by opening Vendor Invitations and creating an invitation again.

## Technical notes
- Missing object: `public.check_my_smtp_configured()` from `supabase/migrations/20260505103815_b9e2b69d-d60e-442a-a3e7-08fa43d10538.sql`.
- Caller: `src/pages/AdminInvitations.tsx` (`supabase.rpc('check_my_smtp_configured')`).
- Depends on table `public.smtp_email_configs` — if that table is also missing on the server, its migration must be applied first.
- Apply via `bash scripts/selfhost/run-migrations.sh` (or `scripts/deploy-vms-server.sh --skip-build --skip-functions`), then `NOTIFY pgrst, 'reload schema';`.
- No frontend rebuild required.

## Result
Creating a vendor invitation on the self-hosted server works again, and the SMTP-configured check behaves the same as on the hosted environment.
