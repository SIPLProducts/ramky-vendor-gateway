# Repair Production Database and CEO Office Skip

## Goal
Restore Production database administration and make **CEO Office → Skip** save successfully, without deleting users, resetting the database, or changing existing approval records.

## Confirmed Differences
- Quality loads its tables normally; Production Studio reports `password authentication failed for user "supabase_admin"`.
- The Production portal is running frontend code that sends `skip_ceo_office`, but its database API reports that this column is absent from `buyer_approval_flows`.
- The application and generated database types already expect `skip_ceo_office`; the repository does not currently contain a matching self-host migration file.

## Recovery Plan
1. Add a read-only Production diagnostic that confirms the Production folder and running stack, checks service health, and compares password fingerprints between saved configuration and running services without printing secrets.
2. Add a guarded database-password repair that aligns the existing `supabase_admin` role with Production’s persisted password, then recreates only password-dependent services. Preserve the database volume and all data.
3. Add an idempotent SQL migration for Production that:
   - adds `buyer_approval_flows.skip_ceo_office boolean NOT NULL DEFAULT false` when absent;
   - updates `seed_vendor_approval_progress` so CEO Office is omitted when the switch is enabled while preserving the existing MSME rule;
   - reloads the database API schema cache.
4. Ensure the self-host deployment runs and records this migration before deploying frontend code that depends on it. Add a post-deploy check that stops with a clear message if the required column is missing.
5. Verify in Production:
   - Studio loads schemas and tables;
   - existing users and records remain present;
   - CEO Office Skip can be enabled, saved, refreshed, and disabled;
   - a skipped CEO Office stage is excluded from new approval chains;
   - other approval-stage skip settings still behave unchanged.

## Safety
- Back up Production environment files before password repair.
- Never print passwords or tokens.
- Never run `docker compose down -v`, remove the database volume, regenerate all secrets, or recreate users.
- Do not alter existing in-progress approval chains automatically; apply the updated routing when a chain is newly seeded or intentionally rebuilt.

## Technical Details
These are two independent Production deployment gaps: Studio’s metadata connection has invalid database credentials, while the portal’s database schema is behind the deployed frontend. Quality confirms the feature behavior itself is valid. Recovery will repair the Production service identity first, then apply and verify the missing schema migration.
