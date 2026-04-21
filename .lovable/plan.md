

## Add explicit Save button to Custom Role Screen Permissions dialog

### Problem
In **Custom Roles → Screens** dialog, each checkbox toggle currently auto-saves immediately via per-row upsert. Users expect to tick several screens and then click **Save** once. There's no visible Save action, so users don't know if/when changes were persisted, and accidental clicks instantly mutate permissions.

### Change
Convert `CustomRolePermissionsMatrix` from auto-save-on-toggle to **stage-then-save** with an explicit Save button.

### Behaviour

```text
Open dialog → load existing perms from DB into `perms` (saved baseline)
            → also keep `draft` copy for in-dialog edits
User ticks/unticks → only `draft` changes; "Unsaved changes" badge appears
[Cancel]            → revert draft = perms, close dialog
[Save changes]      → diff draft vs perms → upsert changed rows in one batch
                    → write one audit_log entry summarising changes
                    → toast "Permissions saved", close dialog
Close (X) with unsaved changes → confirm "Discard unsaved changes?"
```

### Files touched

1. **`src/components/admin/CustomRolePermissionsMatrix.tsx`** — main rewrite
   - Track `saved: Record<string,boolean>` and `draft: Record<string,boolean>`
   - `toggle()` only mutates `draft` (no DB call)
   - New `dirty` derived flag = any key where `draft[k] !== saved[k]`
   - New `handleSave()`:
     - Compute changed keys
     - Single `upsert([...rows])` to `custom_role_screen_permissions` with `onConflict: 'custom_role_id,screen_key'`
     - On success: update `saved`, write one `audit_logs` row `{action:'custom_role_permissions_bulk_updated', details:{custom_role_id, changes:[{screen_key,can_access}...]}}`, toast, call optional `onSaved` callback
   - New `handleCancel()` resets draft
   - Add footer with `Cancel` + `Save changes` buttons (Save disabled when `!dirty` or `saving`)
   - Show small "Unsaved changes" badge in header area when `dirty`
   - Accept new optional props: `onDirtyChange?(dirty)`, `onSaved?()`

2. **`src/pages/CustomRoles.tsx`** — small updates
   - Move dialog Save/Cancel out of matrix or keep matrix-owned (chosen: matrix-owned for reuse)
   - Intercept `onOpenChange(false)` → if matrix is dirty, `confirm('Discard unsaved changes?')` before closing
   - Track `permsDirty` via `onDirtyChange` from the matrix
   - On `onSaved`, close the dialog and refresh role list (no count change needed but keeps UX consistent)

### UI

```text
┌─ Screen Permissions — Finance Reviewer ─────────────[X]┐
│ Check the screens users with this role can access.    │
│ [• Unsaved changes]                                    │
│                                                        │
│ ☐ Dashboard          ☑ All Vendors                     │
│ ☑ Finance Review     ☐ SCM Approval                    │
│ ...                                                    │
│                                                        │
│                              [Cancel] [Save changes]   │
└────────────────────────────────────────────────────────┘
```

### Expected result
- Toggling checkboxes is free and reversible inside the dialog
- One explicit Save persists all changes atomically
- Clear visual signal when there are unsaved edits
- Closing the dialog with unsaved edits prompts the user
- One audit log entry per Save (not per checkbox), easier to read in Audit Logs

### Technical notes
- Bulk upsert is a single round-trip — faster than current per-toggle behaviour
- Existing RLS policies on `custom_role_screen_permissions` already allow admin upsert; no DB changes needed
- `useScreenPermissions` consumers pick up the change on next refetch (already triggered by `is_active` join + role-key invalidation flow)
- Behaviour of the **built-in** role matrix in `RolePermissions.tsx` is left unchanged in this task; if desired we can apply the same pattern there in a follow-up

