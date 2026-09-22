# Repair Production Studio Database Authentication

## Goal
Restore the Production Users screen without resetting the database, deleting users, or regenerating application secrets.

## Confirmed Issue
The screenshot shows Production Studio failing with `password authentication failed for user "supabase_admin"`. The page and Studio are reachable; the failure occurs when Studio's database-management service authenticates to PostgreSQL.

The deployment keeps `POSTGRES_PASSWORD` in both `backend/.env.secrets` and the generated `backend/.env`, while the existing database volume retains the password previously assigned to `supabase_admin`. A deployment or container restart can reveal a mismatch if one of those files was replaced, regenerated, or edited without updating the existing database role.

## Recovery Plan
1. Add a read-only production diagnostic that:
   - confirms the Production application root and Compose project;
   - compares password fingerprints, never plaintext, between `.env.secrets`, `.env`, and the running database-management container;
   - checks database and Studio-related container health and recent authentication errors;
   - detects whether Production accidentally loaded another environment's files.
2. Add a guarded repair command that uses the running database container's local administrator access to align the `supabase_admin` role password with Production's existing persisted `POSTGRES_PASSWORD`.
3. Recreate only password-dependent services such as Studio/database metadata, REST, Auth, Storage, Realtime, and the connection pooler. Do not recreate or remove the database volume.
4. Verify:
   - direct `supabase_admin` authentication succeeds;
   - the database metadata service can query PostgreSQL;
   - Authentication → Users loads again;
   - the portal can still sign in and read existing data.
5. Add deployment protection that stops future Production restarts when `.env.secrets` and `.env` disagree, and prevents `--reset-secrets` from silently rotating credentials against an existing database volume.

## Safety
- Back up both Production environment files before repair.
- Never print passwords or tokens.
- Do not use `docker compose down -v`, remove the database volume, or regenerate all secrets.
- If the saved password files disagree, stop and report which file changed rather than guessing.

## Technical Details
The repository currently persists secrets in `backend/.env.secrets`, rewrites `backend/.env` from them during full setup, and starts the Compose stack afterward. The normal update script only recreates selected services, so it does not currently validate that the persisted database role and service configuration still agree.
