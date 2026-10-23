# Dashboard: Approver Names and Invited By, Test Copy vs Production

## 1. Approver names in the test copy (no code change)
Approver name lookup behaves the same in both places. Production shows names, such as "Finance 2 (Jayavardhan Reddy)", because those applications have a buyer and a set-up approval flow. In the test copy, the "Not assigned" rows are sample records with no invitation, so there is no buyer to look up. These records also show "—" under Invited By:
- Coastal (20260723001), Delta (20260723002) and Everest have no invitation.
- 20260728002 shows "Finance 2 (Stage skipped)". This is correct because its buyer's flow skips Finance 2.

In Production, "SCM CO (Not assigned)" on 20261017001 means that buyer's flow has no SCM CO user. You can fix this in Approval Matrix without changing any code.

## 2. Invited By is blank in Production (fix)
**Likely cause.** The two lookups find invitations in different ways:
- The approver lookup runs securely on the server. It finds the invitation through the application's saved invitation link or through the invitation's vendor link.
- The Invited By column checks only the invitation's vendor link, and it reads directly from the browser.

In Production, many invitations are probably connected only through the application's saved invitation link, or are hidden from the browser read. In both cases Invited By shows "—" even though approver names show. Step 1 confirms this on Production before the fix goes in.

**Change.**
- The secure server lookup that already returns approver names will also return the inviting buyer's name and email. It uses the same invitation matching and covers only applications the signed-in user can already see.
- The Invited By column, its search and the export will use that result. The current browser lookup stays as a fallback.
- Vendor email display, approval routing, permissions and other columns stay the same.

## Technical details
- `supabase/functions/dashboard-approvers/index.ts`: add `invitedBy: { name, email } | null` per vendor. Use the invite already chosen (`invitation_id` first, then latest by `vendor_id`) and the profile of `created_by`, with a fallback to the invite email.
- `src/pages/Dashboard.tsx`: merge `invitedBy` into `r.invited_by` when the existing lookup returned nothing.
- Self-hosted Production needs the function redeployed and the frontend rebuilt. No database migration is needed.

## Verification
- Step 1: run a read-only query on Production to check how 20261023001's invitation is linked (`vendor_id` vs `vendors.invitation_id`).
- After the change, check the test-copy dashboard: Invited By still fills in for linked rows, and rows without an invitation still show "—".
