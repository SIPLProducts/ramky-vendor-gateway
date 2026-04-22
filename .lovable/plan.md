

## Approver Name & Email — pull from full user database (verify & finalize)

### Context

The previous change already switched `ApprovalMatrixConfig` to source approvers from `useAllProfilesWithRoles()` (all profiles in `profiles` table) instead of tenant-only users. This plan verifies that's working end-to-end and tightens any remaining gaps so the admin's experience matches the request: pick any registered user from a dropdown to build the approval matrix.

### What admin will see after this pass

- **Approver (Name)** dropdown → searchable list of every user from `profiles` (full_name + email shown).
- **Email** dropdown → same user list, searchable by email; selecting either column auto-fills the other (shared `user_id`).
- **Role** dropdown → user's current `app_role`, editable by admins.
- **Level #** and **Mode** → unchanged.
- Selecting a user not yet in `user_tenants` for the chosen tenant auto-creates that link on Save All — no manual "Assign Users" step required.

### Fixes in this pass

1. **Confirm hook usage** in `src/components/admin/ApprovalMatrixConfig.tsx`
   - Ensure `useAllProfilesWithRoles()` is the active source for both Name and Email comboboxes (no leftover `useTenantUsersWithRoles` reference for the dropdown options).
   - Both columns share one `user_id` per row; selection in either updates the row's `user_id` and the other column reflects it.

2. **Loading & empty states**
   - While profiles are loading, both comboboxes show "Loading users…" instead of "no users".
   - When the search yields nothing, show "No users match" with a hint: "Invite new users from User Management."

3. **Auto-link to tenant on save**
   - In `saveAll`, after collecting selected `user_id`s, diff against existing `user_tenants` rows for the chosen `tenant_id` and insert missing pairs in one batch. Console trace: `[ApprovalMatrix] auto-linking N users to tenant <id>`.
   - Invalidate `tenant-users-with-roles` and `tenant-user-counts` queries on success.

4. **Role column editability**
   - Role dropdown stays editable for `sharvi_admin` / `admin` only (uses `useAuth().userRole`); read-only badge for everyone else.
   - Pending role changes are applied via `user_roles` delete+insert after the matrix upsert succeeds (existing logic, just verified).

5. **Diagnostics panel still in place**
   - Keeps the "Currently in database: N levels, M approvers" strip.
   - Validation list now reads "Row X · No approver selected" / "Row X · Duplicate approver at Level Y" — no Level Name / Designation checks.

### Files touched

- `src/components/admin/ApprovalMatrixConfig.tsx` — single file, verification + the loading-state and empty-state polish, plus confirm the auto-link block runs and invalidates caches.

### Out of scope

- No DB schema or RLS change.
- No change to `route-vendor-approval`, `process-approval-action`, or downstream approval flow.
- No change to `AssignUsersToTenantDialog` (still available as a power-user shortcut).
- No change to `useAllProfilesWithRoles` hook itself.

### After the change — quick check

1. Open **Admin Configuration → Approval Matrix** → pick a tenant.
2. Click into Approver column → see every registered user from the database.
3. Pick one — Email column fills automatically with that user's email; Role column shows their current role.
4. Add more rows for higher levels, then **Save All**.
5. Top strip refreshes: "Currently in database: N levels, M approvers" — confirms persistence; any newly used users are now also linked to that tenant.

