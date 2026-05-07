## Issue

Saving the Approval Matrix fails with:
`duplicate key value violates unique constraint "approval_matrix_levels_tenant_id_level_number_key"`

## Cause

In `src/components/admin/ApprovalMatrixConfig.tsx` (`saveAll`, lines 296–319), when a row has no `level_id` (e.g. you clicked **Add Row** for Level 5, or the row was loaded from the previous draft), the code calls a plain `INSERT` for `(tenant_id, level_number)`. But the L5 · CEO Office row I seeded earlier already exists in the database for that tenant, so the unique key `(tenant_id, level_number)` blows up.

## Fix

Change the new-level path from `insert` to `upsert` keyed on `(tenant_id, level_number)`:

```ts
const { data, error } = await supabase
  .from('approval_matrix_levels')
  .upsert(levelPayload, { onConflict: 'tenant_id,level_number' })
  .select('id')
  .single();
```

This way, if a level with that `(tenant_id, level_number)` already exists, its fields (stage, mode, msme flag, etc.) are updated and the existing `id` is returned — and the existing approvers under it get cleaned + re-inserted by the next block, exactly like the update branch already does.

No schema changes, no other files touched.

## Verification

1. Reload `/admin/users` → Approval Matrix → Ramky Infrastructure Limited.
2. Click **Save All** with the same 5 rows shown in the screenshot → no error, toast shows "5 level(s), 5 approver(s)".
3. Re-open: rows persist, "Currently in database" shows 5 levels.
4. Edit Level 5 stage / approver → save again → no error.
