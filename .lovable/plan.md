## What's happening

The error `duplicate key value violates unique constraint "approval_matrix_levels_tenant_id_level_number_key"` happens when you add a new level inside **SCM Manager** while the other stages (SCM Head, Finance 1, Finance 2, CEO Office) already exist at L2, L3, L4, L5 in the database.

### Why

`ApprovalMatrixConfig.saveAll()` renumbers every saved level **sequentially** based on the current configuration:

- Existing DB state: L1 SCM Manager, L2 SCM Head, L3 Finance 1, L4 Finance 2, L5 CEO
- After adding a second SCM Manager group, the new plan becomes: L1 + L2 SCM Manager, L3 SCM Head, L4 Finance 1, L5 Finance 2, L6 CEO

The save loop processes groups in order and writes each level immediately:

1. L2 SCM Manager (new) → upsert at `level_number = 2` collides with the existing SCM Head row.
2. SCM Head → tries to UPDATE its row to `level_number = 3`, but Finance 1 still occupies 3 → **unique constraint violation**.

Each downstream stage is still parked on its old number, so any "shift everyone up by one" UPDATE blows up on the next row in the chain. That is the message you see in the red toast.

The same class of bug fires whenever the renumbering plan tries to move an existing level into a slot that another existing level still holds.

## Fix plan

Edit only `src/components/admin/ApprovalMatrixConfig.tsx` (the saver). No schema, no other UI changes.

1. **Park existing levels out of the way first.** At the start of `saveAll`, for the current tenant run a single `UPDATE approval_matrix_levels SET level_number = level_number + 10000 WHERE tenant_id = :tenant`. This frees every L1..Ln slot before any new write happens. The unique key still holds because the offset values are unique.

2. **Then run the existing per-group loop unchanged**, but switch the "no level_id" branch from `upsert(..., { onConflict: 'tenant_id,level_number' })` to a plain `insert(...)`. After step 1 there is no row left at the target `level_number`, so insert is safe and we never accidentally overwrite a different stage's row.

3. **Cleanup pass stays the same** — after saving, delete any tenant levels whose id is not in `keptLevelIds` (these will be the parked-but-no-longer-used rows from step 1, plus any rows the user removed in the UI).

4. **Wrap the save in a clearer error path.** If step 1 fails, abort early and toast `Save failed — could not reserve level numbers` so we never leave the matrix in the offset state.

5. **Guardrail in `addRow` for SCM Manager.** Today `nextLevel = Math.max(...)` reuses the highest existing SCM level (so two rows share the same L number unless the user changes the dropdown). Bump it to `Math.max(...) + 1` so a freshly added approver lands on its own level by default. Users can still merge two approvers into the same level via the Level # dropdown.

## After the fix

- Adding L2 in the SCM Manager tab with SCM Head/Finance 1/Finance 2/CEO already configured saves cleanly.
- The Approval Chain preview renumbers to: L1 SCM Mgr → L2 SCM Mgr → L3 SCM Head → L4 Finance 1 → L5 Finance 2 → L6 CEO.
- Existing approver assignments are preserved (we only re-shuffle `level_number`; `level_id` values keep their approvers via the `level_id` foreign key on `approval_matrix_approvers`).
- No migration required.