# Complete the Production Repair and Deployment

## Goal
Restore the Production database administration screen and apply the missing CEO Office Skip database change without deleting users, vendors, or other records.

## Steps on the Production Server

1. The listing confirms `/opt/Ramky_Applications/PROD/VMS/scripts/selfhost` contains only deployment scripts. Run the database repair directly from this current folder:

```bash
sudo APP_ROOT=/opt/Ramky_Applications/PROD/VMS \
  bash ./repair-production-db-auth.sh --repair
```

2. Separately locate or copy the **complete latest project folder**. It must contain all four entries:
   - `package.json`
   - `src/`
   - `supabase/`
   - `drizzle/`

3. If the repair finishes with `Database login repaired and verified`, change to the complete project folder and run the Production deployment. Replace `/path/to/latest-project` below with its actual path:

```bash
sudo PUBLIC_BASE_URL=https://vyapaar.ramky.com \
  APP_ROOT=/opt/Ramky_Applications/PROD/VMS \
  SOURCE_DIR=/path/to/latest-project \
  bash scripts/selfhost/deploy-latest.sh
```

4. Do not use `--skip-migrations`; the missing `skip_ceo_office` column must be applied before the new frontend is activated.

5. Verify after deployment:
   - Production database administration loads schemas, tables, and users.
   - Approval Matrix → CEO Office → Skip saves successfully.
   - Refreshing the page preserves the Skip setting.
   - Existing users and vendor records remain present.

## Stop Conditions

- Do not use `/opt/Ramky_Applications/PROD/VMS/scripts` as `SOURCE_DIR`; the displayed contents confirm it is not the complete project.
- If `package.json`, `src`, `supabase`, or `drizzle` is missing from the intended source folder, stop. Copy or check out the complete latest project before running deployment.
- If the repair reports that `.env` and `.env.secrets` disagree, stop and retain the output; do not reset secrets.
- If either command reports an error, do not continue to the next command.

## Safety

- The repair backs up the Production environment files before changing the database role password.
- It preserves the database volume and all application data.
- Never run `docker compose down -v`, delete the database volume, or regenerate all secrets.
