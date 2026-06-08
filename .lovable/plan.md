Root cause found: the on-behalf Create Vendor flow can briefly load the buyer’s previous vendor draft before the new on-behalf invitation is ready. That can reuse an old vendor row, so the new submission inherits an old approval chain where SCM Manager may already be approved/rejected instead of getting a fresh pending SCM row.

Plan:

1. Prevent old vendor reuse in Create Vendor flow
   - In the vendor registration hook, add an explicit on-behalf mode guard.
   - While a new on-behalf invitation is still being created/loaded, do not fetch the buyer’s normal “self” vendor draft.
   - If the selected on-behalf invitation has no vendor yet, clear any stale `vendorId` so submission creates a new vendor row.

2. Scope saves strictly to the current invitation
   - When saving in on-behalf mode, update an existing vendor only if its `invitation_id` matches the current on-behalf invitation.
   - Otherwise insert a new vendor linked to the current invitation.
   - Always persist the current `invitation_id` and Buyer Company on the vendor row.

3. Fix international on-behalf identity sync
   - For international vendors, sync invitation name/email/phone from `international.company` fields instead of domestic-only fields.
   - This will stop the success dialog/list from showing placeholder values like `onbehalf+...@placeholder.local` or `INTERNATIONAL VENDOR` when real international details were entered.

4. Make approval routing prefer the vendor’s linked invitation
   - Update the approval seeding logic so it uses `vendors.invitation_id` first, falling back to latest invitation only when no explicit link exists.
   - This avoids wrong routing when older duplicate invitation rows already point to the same vendor.
   - Apply the same preference in approval action authorization where needed.

5. Repair the currently affected submission
   - For the affected vendor reference shown in the screenshot (`738643AE`), detach stale duplicate invitation links where safe and re-seed the approval chain from the vendor’s current invitation.
   - Expected result: Buyer is auto-approved for on-behalf submission, and SCM Manager becomes the active pending approver.

6. Verify
   - Confirm the vendor has a fresh approval chain: `BUYER: approved`, `SCM_MANAGER: pending`.
   - Confirm the SCM Manager approval screen returns the vendor under Pending Approval.
   - Confirm a new Create Vendor submission creates a separate vendor row and does not reuse a previous one.