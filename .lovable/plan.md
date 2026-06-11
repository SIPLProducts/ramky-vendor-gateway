## Issue 1 — Admin role permissions

**Diagnosis.** Comparing `role_screen_permissions` for `admin` vs `sharvi_admin` (tenant_id is NULL = global default):

- Admin currently has `sap_api_settings = true` — it should be `false` per your rule.
- Admin already has `kyc_api_settings = false`, so that one is correct.
- For every other screen that Sharvi Admin can access, Admin will be granted the same access. Where Sharvi Admin cannot access a screen, Admin's setting will be left as-is so it does not lose existing access (e.g. approval screens, audit logs, GST compliance).

**Fix.** A migration that, for `tenant_id IS NULL`:
1. Upserts `admin` rows so every screen Sharvi Admin can access becomes accessible to Admin.
2. Explicitly sets `admin` → `kyc_api_settings = false` and `admin` → `sap_api_settings = false`.

No code changes required — `useScreenPermissions` already reads from `role_screen_permissions`.

If you instead want Admin to mirror Sharvi Admin **exactly** (i.e. also lose access to approval/audit/GST screens that Sharvi Admin currently doesn't have), tell me and I'll adjust the migration to do a strict mirror.

## Issue 2 — CEO Office & Finance 2 missing from Approval Matrix dropdowns

**Diagnosis.** In `src/components/admin/ApprovalMatrixConfig.tsx` (line 89):

```ts
supabase.from('user_tenants').select('user_id, tenant_id')
```

`user_tenants` currently has **1,770 rows**, but Supabase / PostgREST caps a single `select` at **1,000 rows by default**. So roughly 770 tenant assignments are silently dropped on the client. The dropdown then filters approvers by "user has the buyer's primary tenant" — and any user whose mappings were truncated (which includes the newer CEO Office and Finance 2 users) is excluded from every stage's dropdown, producing "No users with this role in the buyer's tenant."

I verified in the database that:
- The `Finance 2` custom role is assigned to `jayavardhan.reddy@ramky.com` (159 tenants).
- The `CEO Office` custom role is assigned to `sudarsan.srinivasan@ramky.com` (159 tenants).
- Each buyer's primary tenant IS in both users' tenant sets — so once the client actually loads the full mapping, they will appear.

**Fix.** Paginate the `user_tenants` fetch in `ApprovalMatrixConfig.tsx` so all rows are loaded regardless of the PostgREST page limit:

- Replace the single `select` with a loop that pages by 1,000 (`.range(from, to)`) until fewer than 1,000 rows are returned.
- Same pattern for `profiles` (currently 1 unbounded select — also at risk as users grow).

No schema change needed.

## Files to change

- `src/components/admin/ApprovalMatrixConfig.tsx` — paginate `user_tenants` and `profiles` selects in `loadAll`.
- New migration — adjust `role_screen_permissions` rows for the `admin` role as described.

## Validation

- Open Admin Configuration → Approval Matrix, pick any buyer; the Finance 2 and CEO Office dropdowns will list the assigned users.
- Sign in as an Admin user: KYC API Settings and SAP API Settings stay hidden; every other screen Sharvi Admin can see is accessible.
