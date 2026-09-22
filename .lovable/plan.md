# Complete the Production Repair and Deployment

## Goal
Restore the Production database administration screen and apply the missing CEO Office Skip database change without deleting users, vendors, or other records.

## Steps on the Production Server

1. Confirm that `/opt/Ramky_Applications/PROD/VMS/scripts` is the **complete latest project folder**, not only a collection of shell scripts. It must contain all four entries:
   - `package.json`
   - `src/`
   - `supabase/`
   - `drizzle/`

2. From the complete project folder, run the guarded Production database-password repair:

```bash
cd /opt/Ramky_Applications/PROD/VMS/scripts

sudo APP_ROOT=/opt/Ramky_Applications/PROD/VMS \
  bash scripts/selfhost/repair-production-db-auth.sh --repair
```

3. If the repair finishes with `Database login repaired and verified`, run the complete Production deployment from the same project folder:

```bash
sudo PUBLIC_BASE_URL=https://vyapaar.ramky.com \
  APP_ROOT=/opt/Ramky_Applications/PROD/VMS \
  SOURCE_DIR=/opt/Ramky_Applications/PROD/VMS/scripts \
  bash scripts/selfhost/deploy-latest.sh
```

4. Do not use `--skip-migrations`; the missing `skip_ceo_office` column must be applied before the new frontend is activated.

5. Verify after deployment:
   - Production database administration loads schemas, tables, and users.
   - Approval Matrix → CEO Office → Skip saves successfully.
   - Refreshing the page preserves the Skip setting.
   - Existing users and vendor records remain present.

## Stop Conditions

- If step 1 shows that `package.json`, `src`, `supabase`, or `drizzle` is missing, stop. Copy or check out the complete latest project into a separate source folder before running the deployment.
- If the repair reports that `.env` and `.env.secrets` disagree, stop and retain the output; do not reset secrets.
- If either command reports an error, do not continue to the next command.

## Safety

- The repair backs up the Production environment files before changing the database role password.
- It preserves the database volume and all application data.
- Never run `docker compose down -v`, delete the database volume, or regenerate all secrets.
