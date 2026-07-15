## Root cause

Vendor `FOSS INDIA PRIVATE LIMITED` (Ref `20260709001`) has:
- `primary_email = ""`
- `registered_email = "foss@gmail.com"`
- Invitation email = `sunilkumar@sharviinfotech.com`

Dashboard uses a smarter rule (see `src/pages/Dashboard.tsx` lines 219–223):
- **Self-signup invite** (`on_behalf = false`): show `invitation.email → primary_email → registered_email`.
- **On-behalf** (buyer filled the form for the vendor): show `registered_email → invitation.email → primary_email`.

That's why Dashboard shows `sunilkumar@sharviinfotech.com` (the invited vendor contact) while the Approval screen shows `foss@gmail.com` (the value entered inside the registration form). The approval edge function currently only looks at `vendors.primary_email / registered_email`, ignoring the invitation email.

## Fix

Align the Approval screen's Vendor Email with the Dashboard rule by computing `vendorEmail` in `supabase/functions/list-pending-approvals-by-stage/index.ts` the same way:

1. Fetch invitation `email` (and use existing `created_on_behalf`) for each vendor.
   - BUYER branch: `invsForBuyer` already loaded — extend the select to include `email, created_on_behalf` (already has `created_on_behalf`); add `email`.
   - Downstream branch: `invites` already loaded — extend the select to include `email, created_on_behalf` (already has `created_on_behalf`); add `email`.
2. Replace the current `vendorEmail` assignment (3 places) with:
   ```ts
   const invEmail = (inv?.email && String(inv.email).trim()) || null;
   const primary  = (v?.primary_email && String(v.primary_email).trim()) || null;
   const registered = (v?.registered_email && String(v.registered_email).trim()) || null;
   const onBehalf = !!inv?.created_on_behalf;
   const vendorEmail = onBehalf
     ? (registered || invEmail || primary || null)
     : (invEmail || primary || registered || null);
   ```
3. No frontend changes needed — `StageApprovalView.tsx` already renders `it.vendorEmail || '—'`.

## Scope

- Edit only `supabase/functions/list-pending-approvals-by-stage/index.ts`.
- No schema, no other screens.
- Deploy the edge function after the edit and verify Ref `20260709001` now shows `sunilkumar@sharviinfotech.com` in Buyer Approval.