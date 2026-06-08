## Problem

Two related issues for the buyer "Divya bharathi" on ADIPL-RAMKY JV:

1. Clicking **Create Vendor** or **Create Invitation** triggers a red toast: _"Configuration Required: Buyer–SCM mapping and Approval Matrix are not configured for ADIPL-RAMKY JV…"_ — even though the buyer already has an **Approval Matrix (Buyer Approval Flow)** configured.
2. Vendors that the buyer self-creates (on-behalf) and submits do not appear in the **SCM Manager** queue, despite the flow defining an SCM Manager.

## Root cause

- The readiness gate in `src/pages/AdminInvitations.tsx` (`checkTenantOnboardingReadiness`) still checks the **legacy** tables `buyer_scm_mappings` and `approval_matrix_levels` scoped by `tenant_id`. The current approval engine reads `buyer_approval_flows` (per-buyer, not tenant-scoped). For ADIPL-RAMKY JV those legacy tables are empty, so the gate blocks creation even though `buyer_approval_flows` for Divya is fully configured (SCM Manager Soumendu Sen Gupta, Finance 1, Finance 2, CEO).
- A WIPRO vendor submitted on-behalf earlier has `vendors.status = scm_manager_review` but **zero rows** in `vendor_approval_progress` (audit shows `approval_routing_failed: no_progress_rows_after_submit`). It was submitted while the older broken `seed_vendor_approval_progress` was deployed, so the chain was never seeded. The function is now fixed, but historical rows aren't re-seeded automatically, so SCM Manager sees nothing.

## Fix

### 1. Replace the readiness check with one based on the new flow model (`src/pages/AdminInvitations.tsx`)

- `checkTenantOnboardingReadiness(buyerUserId)` will read `buyer_approval_flows` for the current user (the inviting buyer) and consider the configuration valid when a row exists and at least one downstream approver is set (typically `scm_manager_user_id` unless `skip_scm_manager = true`).
- Drop the `tenant_id` argument and the references to the legacy `buyer_scm_mappings` and `approval_matrix_levels` tables.
- Update `showReadinessToast` copy to: _"Your Approval Flow is not configured. Ask an admin to set it up under User Management → Approval Matrix before inviting vendors."_
- Both `handleCreateVendorClick` and `handleCreateInvitation` will call the new check with just `user.id`; tenant selection no longer affects readiness.

### 2. Re-seed vendors that were stranded by the old bug

- Run `SELECT public.seed_vendor_approval_progress(v.id) FROM public.vendors v LEFT JOIN public.vendor_approval_progress p ON p.vendor_id = v.id WHERE v.status IN ('buyer_review','scm_manager_review','scm_head_review','finance_1_review','finance_2_review','ceo_office_review') AND p.id IS NULL;`
- This rebuilds the BUYER + downstream stage rows for WIPRO (and any similar vendor) using the now-fixed function, so SCM Manager sees the application in their queue.

### Out of scope

- No change to the `seed_vendor_approval_progress` function (already fixed in the previous migration).
- No UI changes other than the readiness gate copy.
- No change to the on-behalf submit flow itself — once readiness no longer blocks, the existing trigger plus route-vendor-approval call seeds the chain correctly.

## Validation

- As Divya, click **Create Vendor** and **New Invitation** on ADIPL-RAMKY JV — no toast, dialog opens / navigation proceeds.
- Confirm WIPRO now appears in **SCM Manager Approval** for Soumendu Sen Gupta.
- Submit a fresh on-behalf vendor and confirm `vendor_approval_progress` is populated (BUYER auto-approved + SCM_MANAGER pending + downstream stages).
