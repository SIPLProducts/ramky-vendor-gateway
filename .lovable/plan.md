## Fix on-behalf delete: FK error + SweetAlert confirmation

**Error:** `update or delete on table "vendor_invitations" violates foreign key constraint "vendors_invitation_id_fkey"` — the draft vendor row references the invitation via `vendors.invitation_id`, so the invitation can't be deleted while that vendor exists (and the previous code also skipped deleting the vendor when its status wasn't exactly `draft`).

### File: `src/pages/AdminInvitations.tsx` (delete handler on the on-behalf trash icon)

1. Replace `window.confirm` with **SweetAlert2** (already in deps):
   ```ts
   import Swal from 'sweetalert2';
   const res = await Swal.fire({
     title: 'Are you sure?',
     text: 'This will permanently delete this on-behalf draft and its vendor record.',
     icon: 'warning',
     showCancelButton: true,
     confirmButtonText: 'Yes, delete',
     cancelButtonText: 'Cancel',
     confirmButtonColor: '#dc2626',
   });
   if (!res.isConfirmed) return;
   ```

2. Fix FK ordering. Delete in this sequence:
   1. **Delete every vendor that points at this invitation** (covers both `vendors.invitation_id = invitation.id` and the direct `invitation.vendor_id`), but **only if `status = 'draft'`**. Safe because on-behalf drafts start in `draft` and we never want to nuke a submitted vendor.
      ```ts
      await supabase.from('vendors').delete()
        .eq('status', 'draft')
        .or(`invitation_id.eq.${invitation.id},id.eq.${invitation.vendor_id ?? invitation.id}`);
      ```
   2. **Null out any leftover `invitation_id` references** on non-draft vendors so the FK no longer blocks the delete (rare, but guards against submitted vendors keeping the invitation pinned):
      ```ts
      await supabase.from('vendors').update({ invitation_id: null })
        .eq('invitation_id', invitation.id);
      ```
   3. **Delete the invitation row.**
   4. If any step returns an error, surface it via toast and abort the remaining steps.

3. On success: SweetAlert success toast (`Swal.fire({ icon: 'success', title: 'Deleted', timer: 1500, showConfirmButton: false })`) and invalidate `['vendor-invitations']`.

### Not touched
- Backend / RLS / migrations — the FK stays; we just delete in the right order.
- SAPSync, edge functions, resend button, non-on-behalf rows.

### File touched
- `src/pages/AdminInvitations.tsx` only.
