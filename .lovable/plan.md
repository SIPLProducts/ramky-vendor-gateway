# Add "Invited By" column to All Vendors and Dashboard tables

## Change

Show the buyer who invited each vendor (name + email) in the Vendor Applications table.

### 1. `src/hooks/useVendors.tsx` — `useVendors`
After fetching vendors, fetch their inviters in one round-trip:
- Query `vendor_invitations` for `vendor_id IN (visibleIds)` → take the most recent row per vendor (`created_by`, `email`).
- Query `profiles` for those `created_by` ids → `full_name`, `email`.
- Attach a non-DB field `invited_by` (`{ name, email } | null`) on each vendor row before returning. Type the return as `VendorRow & { invited_by?: ... }`.

### 2. `src/pages/VendorList.tsx`
Add a new `<TableHead>Invited By</TableHead>` between **Buyer Company** and **GSTIN**. Render `vendor.invited_by.name` with `vendor.invited_by.email` as muted subtext, fallback `—`. Bump empty-row `colSpan` from 7 → 8.

### 3. `src/pages/Dashboard.tsx`
- Extend the `dashboard-vendors` query to also load invitations for the resulting vendor ids and join `profiles`, attaching `invited_by` to each row.
- Add `<TableHead>Invited By</TableHead>` between **Company** and **Email**. Bump empty-row `colSpan` from 5 → 6.
- Add the inviter to the Excel export (column "Invited By").

## Verification
- As an admin and as Raja Mani (SCM Manager), open All Vendors and Dashboard → new "Invited By" column shows e.g. "Ajay Babu · ajaybabu.badugu@ramky.com" for invited vendors and "—" for self-registered ones.
