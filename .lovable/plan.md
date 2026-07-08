## Change

Hide invitations from the Vendor Invitations screen once the invited vendor has submitted their application (including buyer-on-behalf submissions).

### Where
`src/pages/AdminInvitations.tsx` — `filteredInvitations` (lines 595–609).

### How
Each invitation row already joins `vendor:vendors(id, reference_number, status)`. An invitation is considered "submitted" when `invitation.vendor` exists AND `invitation.vendor.status` is anything other than `'draft'` (i.e. the vendor has moved past the draft/registration-in-progress state — covers `submitted`, all `*_review`, `pending_sap_sync`, `sap_synced`, rejections, etc.). Buyer on-behalf submissions follow the same path, so they'll be filtered out too.

Add this predicate at the top of the `filteredInvitations` filter so submitted vendors never appear in the list (nor in pagination / counts):

```ts
const vendorStatus = invitation.vendor?.status as string | undefined;
const submitted = !!invitation.vendor && vendorStatus && vendorStatus !== 'draft';
if (submitted) return false;
```

No other changes:
- Status tabs/counters continue to work off the remaining (non-submitted) rows.
- Backend, RLS, and the vendor list screen are untouched — submitted vendors remain visible under Vendors, just not under Invitations.

### Out of scope
- No change to what "Used" means on the badge (kept as-is per the previous clarification).
- No schema, edge function, or query-layer changes.
