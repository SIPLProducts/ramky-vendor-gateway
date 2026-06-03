Root cause visible from your screenshot and terminal output:

1. The server is still showing the old frontend bundle because the “Skip Buyer Approval” column is still visible even though it was removed in the latest source.
2. Migrations are stopping at `20260106172425...sql` with `ERROR: must be owner of function update_updated_at_column`, so later approval-routing migrations are not applied.
3. Edge functions are not updated just by `docker compose restart functions`; the latest `supabase/functions` files must be copied/synced into `backend/volumes/functions` first.
4. Because migrations stopped, `seed_vendor_approval_progress`, buyer routing, and approval progress rows are likely outdated/missing, so submitted vendors do not appear in Buyer/SCM/approval screens.

Plan to fix:

1. Update the self-host migration runner
   - Add a pre-migration ownership repair step for `public.update_updated_at_column()`.
   - Ensure migrations run as the correct database owner/admin role.
   - Keep the existing `_vms_migrations` tracking so already-applied migrations are not repeated.
   - Stop immediately on failed migration instead of continuing silently.

2. Add a self-host “sync latest code” deploy script/commands
   - Copy local `supabase/migrations/*.sql` into `/opt/Ramky_Applications/DEV/VMS/backend/migrations/`.
   - Copy local `supabase/functions/` into `/opt/Ramky_Applications/DEV/VMS/backend/volumes/functions/`.
   - Copy/build the latest frontend into the actual nginx root: `/opt/Ramky_Applications/DEV/VMS/frontend/dist/`.
   - Restart only the required services after sync: functions, rest/PostgREST schema reload, and nginx.

3. Repair approval routing after migrations succeed
   - Confirm `buyer_scm_mappings.skip_buyer_stage` exists but defaults to `false`.
   - Confirm latest `seed_vendor_approval_progress()` is installed.
   - Re-run approval seeding for submitted vendors currently stuck in SCM/approval status but missing `vendor_approval_progress` rows.
   - Refresh PostgREST schema cache using `NOTIFY pgrst, 'reload schema';`.

4. Add verification SQL/commands
   - Check if migration `20260602115254...` is applied.
   - Check pending approval progress rows for the vendor reference number.
   - Check whether the vendor’s first pending stage is `BUYER`.
   - Check whether the buyer is mapped to an SCM manager and tenant.

5. Final expected result
   - The UI no longer shows “Skip Buyer Approval”.
   - Submitted vendor requests first appear in Buyer approval.
   - After Buyer approval, they route to SCM Manager/SCM Head/Finance according to the approval matrix.
   - New functions and migrations reflect on the self-host server after deployment.