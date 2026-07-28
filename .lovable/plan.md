## Why Sunil's data isn't appearing under Divyabharathi

Verified in the DB:

- Audit log for the Sunil→Divya reassignment ran at `2026-07-28 10:20:52` and the `counts` payload has **no `vendor_invitations` key** — meaning the old function ran without the invitation-transfer block.
- `vendor_invitations` still holds **3 rows with `created_by = Sunil`** and `original_created_by = NULL`:
  - `ef386de7…` → vendor `011ff700…` (ref `20260728001`, status `buyer_review`)
  - `e2a7d28d…` → vendor `2c89dc94…` (ref `20260728002`, status `buyer_review`)
  - `7894dd82…` → `sunilkumar@sharviinfotech.com` (no vendor yet, pending link)
- All 18 rows currently on Divya have `original_created_by = NULL` (her own — never carried Sunil's stamp).

Because visibility for buyers, dashboard and the `list-pending-approvals-by-stage` edge function all key off `vendor_invitations.created_by`, the two vendors above are still tied to the inactive Sunil and invisible to Divya.

Also found: `admin-delete-user` still calls `vendor_invitations.update({ created_by: null })` unconditionally — same bug will bite on Delete. And there's no way to re-run reassignment for an already-inactive user, which is what's blocking the user right now.

## Fix

1. **Backfill migration — transfer the 3 orphan invitations now.**
   ```sql
   UPDATE public.vendor_invitations
      SET original_created_by = COALESCE(original_created_by, '<Sunil-id>'),
          created_by = '<Divya-id>'
    WHERE created_by = '<Sunil-id>';
   ```
   Run once via the migration tool. This unlocks the two `buyer_review` vendors for Divya immediately.

2. **`admin-delete-user`: mirror the reassignment logic added to `reassign-user-work`.**
   Replace the unconditional `nullify_created_by` step with:
   - If `replacement_user_id` provided → `UPDATE vendor_invitations SET created_by = <repl>, original_created_by = COALESCE(original_created_by, <old>) WHERE created_by = <old>`
   - Else → keep the current NULL behavior (guest / detached invitations).
   Include `vendor_invitations` in `applied` counts and in the pre-delete impact preview so the confirmation dialog shows the number.

3. **Add a "Reassign leftover work" admin action for already-inactive users.**
   Extend `reassign-user-work` to accept a mode where `inactive_user_id` may be a user whose `profiles.status = 'inactive'` (already), and expose it from the User Management row menu ("Reassign work…" shown only when status = inactive and impact counts > 0). Same eligibility rules as today. This prevents the current dead-end where the only recovery is manual SQL.

4. **UI surfacing.**
   In `ReplaceUserDialog` and the new "Reassign work…" dialog, always render the `vendor_invitations` count line (even when 0) so the operator can confirm the transfer number matches expectations before applying.

5. **No changes needed** to `list-pending-approvals-by-stage`, `useVendors`, or Dashboard RLS — once `created_by` is flipped, all three surfaces resolve to Divya automatically. Buyer-stage `vendor_approval_progress` rows for the two vendors remain `pending` with no `acted_by`, so Divya can approve them directly (Option A, as previously agreed).

### Files touched
- New migration: one-shot UPDATE for the 3 stray invitations.
- `supabase/functions/admin-delete-user/index.ts`: replace the invitations step; include in `applied` and preview counts.
- `supabase/functions/reassign-user-work/index.ts`: allow running when the target is already inactive.
- `src/components/admin/ReplaceUserDialog.tsx`: always show the invitations count line; add "Reassign work…" entry-point when opened for an inactive user.
- `src/pages/UserManagement.tsx`: expose the new action on inactive rows.

Approve to implement.
