## Problem

On `/admin/invitations`, the Buyer (Ajay Babu) sees the invitation row for the returned vendor (kvvk / BADE MURALI KRISHNA), but no "Returned to Buyer" badge, no rejection remarks, and no "Send to Vendor" action button.

The UI code in `AdminInvitations.tsx` already renders all of this when `invitation.linked_vendor.status === 'returned_to_buyer'`. The query also already fetches `vendors` by `id IN (vendor_ids)`.

**Root cause:** RLS on `public.vendors` has no policy that lets a Buyer (app_role `vendor`, custom role `Buyer`) read a vendor they invited. The existing SELECT policies only cover admins, finance, purchase, approvers, SCM Manager mapping, cross-tenant reviewers, and the vendor's own user. So the enrichment query returns no rows and `linked_vendor` is always `null` — the badge and action never render.

## Fix

Add a single RLS SELECT policy on `public.vendors` that lets any authenticated user read vendors linked to invitations they created. Buyers will then see the returned vendor's status + remarks, and the existing UI will surface the "Send to Vendor" action that already wires to the `buyer-return-to-vendor` edge function (which already notifies the vendor with the remarks).

### Migration

```sql
CREATE POLICY "Inviting users view their vendors"
ON public.vendors
FOR SELECT
TO authenticated
USING (
  EXISTS (
    SELECT 1 FROM public.vendor_invitations vi
    WHERE vi.vendor_id = vendors.id
      AND vi.created_by = auth.uid()
  )
);
```

No code changes required — `AdminInvitations.tsx` and `buyer-return-to-vendor` already handle the rest. The vendor portal already shows `last_rejection_comments` as a banner on `returned_to_vendor` status and allows resubmission.

## Validation

As Ajay Babu on `/admin/invitations`:
- The kvvk row shows a red "Returned to Buyer" badge with SCM Manager's remark ("state mismatch").
- A "Send to Vendor" button appears in the Actions column.
- Clicking it opens the review dialog; submitting calls `buyer-return-to-vendor`, which sets the vendor to `returned_to_vendor`, emails the vendor with the combined remarks, and the row refreshes.
- The vendor then sees the rejection banner on their portal, edits the application, and resubmits — which reseeds approvals back to SCM Manager.
