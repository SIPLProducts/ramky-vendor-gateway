

## Why the SCM approval queue is empty

I checked the database and found two problems for tenant `SHARVI INFOTECH`:

1. **No approval matrix is configured** for this tenant. `approval_matrix_levels` has zero rows for tenant `6fd07201-…`, so `route-vendor-approval` ran on submit, found no levels, and skipped seeding (silent — no error). The vendor sits in `purchase_review` with no progress rows and no approver can see it in **My Approvals**.
2. **No assigned approvers** even when levels are eventually added — `approval_matrix_approvers` is empty.

Result: the `My Approvals` page shows "No pending approvals" for everyone, and `vendor_approval_progress` is empty.

## What you need to do (configuration, no code change required for this vendor)

Go to **Admin → Approval Matrix** and for the tenant **SHARVI INFOTECH**:
1. Add one or more SCM approval levels (e.g., L1 = SCM Manager, L2 = SCM Head). Levels execute from **highest level_number → 1** sequentially.
2. For each level, assign one or more approver users.
3. Then re-route the existing vendor (see fix below) so progress rows get created retroactively.

## What I will build (so this never happens silently again)

### A. Visibility — "Approval Progress" panel on vendor screens
- Add a **Workflow** tab/section in `PurchaseApproval.tsx` (and reuse on `FinanceReview.tsx`) using the existing `ApprovalTimeline` component. Shows every level (L_n → L_1), status badge (pending / approved / rejected), approver name, timestamp, and comments — so anyone reviewing a vendor can see exactly where it is in the SCM chain and who's holding it up.
- Reuse the existing `useVendorApprovalTrail` hook.

### B. Banner when matrix is missing
- In `PurchaseApproval.tsx`, when a vendor in `purchase_review` has **zero rows** in `vendor_approval_progress`, show a red warning card on the vendor row: "No SCM approval matrix configured for this buyer company. Configure it in Admin → Approval Matrix." with a deep link to the admin page.
- In the submit flow (`useVendorRegistration`), after invoking `route-vendor-approval`, surface a non-blocking toast warning when the function returns `message: 'No matrix configured; skipping'` so the submitting user knows.

### C. Manual "Re-route approval" action
- Add a small **"Re-route"** button (admin/customer_admin only) on the vendor card in `PurchaseApproval.tsx` that re-invokes `route-vendor-approval` for that vendor. Use this once the matrix is configured to seed `vendor_approval_progress` for the existing stuck SHARVI INFOTECH vendor without re-submitting.

### D. Admin dashboard widget
- New small card on `Dashboard.tsx` for admins: "Vendors stuck without approver" — counts vendors in `purchase_review` with no `vendor_approval_progress` rows. Click → goes to Approval Matrix admin.

### Out of scope
- No change to approval ordering, Finance step, or SAP sync.
- No auto-creation of default matrix (intentional — needs admin choice of levels/approvers).

### Files touched
- `src/pages/PurchaseApproval.tsx` — add Workflow tab in details dialog, "missing matrix" warning, "Re-route" admin button
- `src/pages/FinanceReview.tsx` — confirm the Workflow tab already added there is wired (no functional change)
- `src/hooks/useVendorRegistration.tsx` — surface "no matrix" warning toast on submit
- `src/pages/Dashboard.tsx` — add "stuck vendors" admin widget
- New hook helper in `src/hooks/useVendors.tsx` — `useReRouteApproval(vendorId)` that invokes the existing `route-vendor-approval` edge function (no edge function changes)

