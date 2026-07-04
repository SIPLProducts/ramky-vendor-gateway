## Diagnosis

The submission fails at the file-upload step with **"new row violates row-level security policy"** on the `vendor-documents` storage bucket.

Root cause: the current storage INSERT policy on `storage.objects` for `vendor-documents` only allows the upload if the uploader is the **vendor's own `user_id`** (or an internal reviewer):

```
v.user_id = auth.uid()  OR  lower(v.primary_email) = lower(auth.jwt().email)  OR  <admin/reviewer roles>
```

For "submit on behalf of vendor", the buyer is signed in but:
- The `vendors` row being written to has `user_id` set to a different auth user (see the two rows found for invitation `d879cfe2…`: one owned by the buyer `5fceecd3…`, another owned by `9e57348c…`). The client picks one of them at upload time, and when it picks the row whose `user_id ≠ buyer`, the storage INSERT is denied.
- `primary_email` on both rows is empty, so the email-match branch also fails.
- The buyer holds no admin/reviewer role, so the role branches don't help.

Result: PDF/image uploads (gst_certificate, pan_card, cheque, msme, etc.) are rejected → "Submission Failed".

There is also a secondary data issue: **two vendor rows exist for the same invitation** because the on-behalf flow created a second draft when a different auth user visited the invite. That's a follow-up to clean up but isn't required to unblock submission.

## Fix

Extend the four `vendor-documents` storage policies (INSERT, SELECT, UPDATE, DELETE) so a **buyer who created the invitation for that vendor** is also allowed. This mirrors the existing `user_can_see_vendor(...)` model already used for vendor RLS.

New matching condition to add (in addition to existing ones):

```
EXISTS (
  SELECT 1
  FROM public.vendors v
  JOIN public.vendor_invitations vi ON vi.vendor_id = v.id OR vi.id = v.invitation_id
  WHERE (v.id)::text = (storage.foldername(objects.name))[1]
    AND vi.created_by = auth.uid()
)
```

Migration will `DROP` the four existing `vendor-documents` policies and recreate them with the buyer branch added. No table-schema changes.

## Files touched

- One migration file that drops + recreates the four `storage.objects` policies scoped to `bucket_id = 'vendor-documents'`.
- No app-code changes.

## Verification

1. As the buyer, resubmit the on-behalf application → upload succeeds, submission completes.
2. Vendor themselves can still upload/view their own files (existing branch preserved).
3. Admin/finance/purchase reviewers can still view (existing branches preserved).

## Follow-up (not in this change)

The duplicate vendors row for invitation `d879cfe2…` should be reconciled (delete or merge the stale row) — I can do that separately once you confirm which of the two is the intended one; the RLS fix above unblocks submission regardless.
