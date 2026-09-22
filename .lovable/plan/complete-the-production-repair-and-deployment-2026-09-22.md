# Complete the Production Repair and Deployment

## Goal
Restore the Production database administration screen and apply the missing CEO Office Skip database change without deleting users, vendors, or other records.

## Steps on the Production Server

1. The listing confirms `/opt/Ramky_Applications/PROD/VMS/scripts/selfhost` contains only deployment scripts. Run the database repair directly from this current folder:

```bash
sudo APP_ROOT=/opt/Ramky_Applications/PROD/VMS \
  bash ./repair-production-db-auth.sh --repair
```

2. Copy the migration file from the latest project package into Production's migration folder:

```bash
sudo cp /path/to/latest-project/drizzle/migrations/0001_add_ceo_office_skip_to_approval_flows.sql \
  /opt/Ramky_Applications/PROD/VMS/backend/migrations/20260922065300_add_ceo_office_skip_to_approval_flows.sql
```

3. Apply the copied migration with Production's installed migration runner:

```bash
sudo APP_ROOT=/opt/Ramky_Applications/PROD/VMS \
  bash /opt/Ramky_Applications/PROD/VMS/run-migrations.sh
```

4. Confirm the runner reports the CEO Office migration as applied with `failed=0`. The migration also reloads the API schema cache.

5. Verify after deployment:
   - Production database administration loads schemas, tables, and users.
   - Approval Matrix → CEO Office → Skip saves successfully.
   - Refreshing the page preserves the Skip setting.
   - Existing users and vendor records remain present.

## Stop Conditions

- Do not run `deploy-latest.sh` from `/opt/Ramky_Applications/PROD/VMS/scripts`; the displayed folder contains deployment scripts but not the migration source it requires.
- Do not manually type only `ADD COLUMN`. Use the complete supplied migration because it also updates CEO Office routing and reloads the schema cache.
- If the repair reports that `.env` and `.env.secrets` disagree, stop and retain the output; do not reset secrets.
- If either command reports an error, do not continue to the next command.

## Safety

- The repair backs up the Production environment files before changing the database role password.
- It preserves the database volume and all application data.
- Never run `docker compose down -v`, delete the database volume, or regenerate all secrets.
