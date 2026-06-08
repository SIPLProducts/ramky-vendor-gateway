## Root cause

The "Approval chain not seeded" error on Create Vendor (on-behalf) submit is caused by an authorization mismatch in the `route-vendor-approval` edge function — **not** a missing approval matrix.

What I found in the database for the affected vendor `686173A0`:

- Vendor row exists, `submitted_at` is set, but `status` was overwritten back to `draft` (autosave after submit) and there are **zero** rows in `vendor_approval_progress`.
- The buyer who submitted on-behalf is `Divya bharathi` with app_role `approver` and custom role `Buyer`.
- A valid `buyer_approval_flows` row exists for her (SCM Mgr Soumendu, SCM Head skipped, Finance 1, Finance 2, CEO Office configured).
- `seed_vendor_approval_progress` would succeed if called — the matrix is fine.

The edge function `route-vendor-approval` currently requires one of these roles:
`['admin', 'sharvi_admin', 'customer_admin', 'finance', 'purchase', 'vendor']`.

The submitting buyer has neither `approver` nor `Buyer` in that allowlist, so the call returns **403 "Forbidden — insufficient role"**. The frontend then sees no progress rows and shows the "Approval chain not seeded" toast. Because there is no DB trigger bound to `vendors` (only the trigger function exists), nothing else seeds the chain — submission silently fails to enter the workflow.

Additionally, an autosave fires right after submit and rewrites `vendors.status` back to `draft`, masking the real status and preventing any retry from working cleanly.

## Fix plan

1. **Unblock approval seeding for buyers (root fix)**
   - In `supabase/functions/route-vendor-approval/index.ts`, drop the over-restrictive role allowlist and require only an authenticated user (same pattern as `buyer-reapprove-rejected`). Seeding logic itself is a `SECURITY DEFINER` RPC scoped to the vendor id, so this is safe.

2. **Stop autosave from clobbering submitted vendors**
   - In `src/hooks/useVendorRegistration.tsx` `saveVendorMutation`, never write `status: 'draft'` when updating an existing vendor whose current status is anything other than `draft` / `returned_to_vendor`. Read the current status (or use a guarded update) and omit the `status` field on update so a post-submit autosave cannot revert `scm_manager_review` back to `draft`.

3. **Repair the stuck submission (`686173A0`)**
   - Re-run `seed_vendor_approval_progress` for this vendor via the fixed edge function (or admin RPC) so it enters `SCM_MANAGER` pending for Soumendu Sen Gupta.
   - Set `vendors.status = 'scm_manager_review'` so the UI lists it correctly.

4. **Verify**
   - Confirm `vendor_approval_progress` has rows: `BUYER approved (on-behalf)`, `SCM_MANAGER pending`, `FINANCE_1 pending`, `FINANCE_2 pending` (CEO_OFFICE only if MSME, which this vendor isn't).
   - Open SCM Manager Approval as Soumendu and confirm `sparkle` appears in the pending list.
   - Submit a fresh on-behalf vendor end-to-end and confirm it routes to SCM Manager without the red toast.

## Files to change

- `supabase/functions/route-vendor-approval/index.ts` — relax role allowlist.
- `src/hooks/useVendorRegistration.tsx` — guard autosave so it cannot reset `status` to `draft` post-submit.
- Data repair migration / admin call for vendor `686173A0`.
