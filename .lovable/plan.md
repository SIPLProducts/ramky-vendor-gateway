## Goal
When an approver (e.g. SCM Manager) rejects an application and it bounces back to the Buyer, the Buyer must clearly see the rejection remarks, be able to forward the request to the Vendor, and the Vendor must receive the remarks and be able to edit and resubmit the existing application.

## Current state
- Backend already moves rejected applications to `returned_to_buyer` and stores `last_rejection_comments` / `last_rejection_stage`.
- The example vendor (`BADE MURALI KRISHNA`) is already in `returned_to_buyer` with remark `state mismatch` from `SCM_MANAGER`, linked to buyer `Ajay Babu`.
- The `buyer-return-to-vendor` edge function and the vendor-side `returned_to_vendor` banner already exist.
- Gap: the Buyer's primary screen (Vendor Invitations) does not surface returned applications, so the Buyer cannot act on them.

## Implementation plan

1. **Surface returned applications on the Buyer's Vendor Invitations screen**
   - Extend the invitation list query to also load the linked vendor record (status, name, last rejection stage, last rejection comments, last rejected at).
   - For invitations whose linked vendor is `returned_to_buyer`, show:
     - a clear "Returned to Buyer" status badge,
     - the rejection stage (e.g. SCM Manager) and remarks inline under the row.

2. **Add a Buyer "Review & Send to Vendor" action**
   - For returned rows, add an action button that opens a dialog showing:
     - vendor name,
     - rejection stage,
     - approver rejection remarks (read-only),
     - an optional buyer remarks textarea.
   - On submit, call the existing `buyer-return-to-vendor` edge function with the vendor id and combined remarks, then refresh the list.

3. **Send a notification with rejection remarks to the Vendor**
   - Reuse the existing `send-status-notification` invocation inside `buyer-return-to-vendor` so the email body includes both the approver's rejection remarks and the buyer's added remarks.
   - Verify the email payload contains the full combined remarks.

4. **Vendor side: show remarks and allow edit + resubmit of the existing application**
   - The vendor registration screen already shows a `returned_to_vendor` banner with `last_rejection_comments` and `last_rejection_stage`. Confirm it loads the existing application (not a new draft) and that all fields are editable.
   - On resubmit, the existing trigger reseeds approval progress and routes back to the first approver — keep this behavior unchanged.

5. **Validation**
   - As the buyer (Ajay Babu), confirm `BADE MURALI KRISHNA` now appears as "Returned to Buyer" with the SCM Manager rejection remark on the Vendor Invitations screen.
   - Use the new action to send it to the vendor; confirm the vendor's status becomes `returned_to_vendor`, an email is dispatched, and on the vendor portal the rejection remarks are visible and the form can be edited and resubmitted.

## Notes
- No database schema changes required; all needed columns and the edge function already exist.
- Changes are limited to:
  - `src/pages/AdminInvitations.tsx` (Buyer screen — surface returned vendors + action)
  - small adjustment to `buyer-return-to-vendor` if the email body needs the remarks explicitly included
  - verification on `src/pages/VendorRegistration.tsx` that the returned-to-vendor banner + edit flow already work end-to-end.