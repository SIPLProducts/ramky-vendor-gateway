## Confirmed causes

- **“L1” is a UI mapping bug.** SAP rejection history is stored with `stage = 'SAP_TEAM'` and no level number, but the shared label formatter has no `SAP_TEAM` case and falls back to `L1`.
- **DEV/PROD cannot currently read approval history.** The reported `PGRST205` proves the REST API cannot see `public.vendor_approval_history`. The repository contains its migration, but some self-hosted deployment paths do not reload the REST schema after migrations. On the connected local database, the table and SAP Team history rows do exist.
- Approval functions currently **ignore history-insert errors**, so an approval can complete while its mandatory comment silently fails to enter the history table.

## Implementation plan

1. **Add an idempotent repair migration**
   - Ensure `public.vendor_approval_history` exists with the required columns, foreign key, index, explicit grants, RLS, and vendor-visibility policies.
   - Backfill recoverable approved/rejected comments from `vendor_approval_progress` without creating duplicates.
   - Make the migration safe on local, DEV, and PROD whether the table already exists or is missing.

2. **Make every self-hosted migration path refresh the REST schema**
   - Add `NOTIFY pgrst, 'reload schema'` after migrations in the deployment scripts that currently omit it.
   - Keep the existing reload in the newer self-hosted runner.
   - This prevents newly created tables from continuing to return `PGRST205`.

3. **Fix SAP Team display labels**
   - Add `SAP_TEAM` to the shared approval-stage type and map it to **SAP Team** in both normal and history formatters.
   - Stop fabricating level `1` for null-level stages in the comments dialog.

4. **Stop silent comment-history failures**
   - Check the result of every `vendor_approval_history` insert in normal approval, buyer re-approval, SAP rejection, and SAP return flows.
   - Return/log a clear backend error instead of silently reporting success when the history record cannot be written.

5. **Verify**
   - Confirm local history renders **SAP Team**, not **L1**.
   - Confirm the repair migration is safe against the existing local table and history data.
   - Validate the affected functions and frontend build.
   - Provide the exact self-hosted deployment command for DEV and PROD; both must run migrations and functions without `--skip-migrations` or `--skip-functions`.