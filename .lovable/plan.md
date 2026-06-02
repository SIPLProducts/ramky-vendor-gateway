# Pre-flight Check: Buyer SCM + Approval Matrix Before Creating Invitation

## Goal
Before any vendor invitation is created — both via the **New Invitation** dialog (email send) and the **Create Vendor** button (on-behalf flow) — verify that the selected Company/Tenant has:

1. A **Buyer → SCM mapping** for the current buyer (`buyer_scm_mappings` row where `tenant_id = <selected>` AND `buyer_user_id = auth.uid()`), **and**
2. At least one active **Approval Matrix level** with approvers configured (`approval_matrix_levels` where `tenant_id = <selected>` AND `is_active = true`, joined to `approval_matrix_approvers`).

If either is missing → show a destructive toast and **abort**. If both are present → proceed exactly as today (dialog opens / form navigation happens / invitation row is inserted / routing through `seed_vendor_approval_progress` runs unchanged after submission).

Super admins (`sharvi_admin`, `admin`) and customer admins are also subject to the check — the requirement is that the tenant be properly configured before any vendor onboarding starts, regardless of who clicks the button.

## Changes (single file)

### `src/pages/AdminInvitations.tsx`

1. **Add a shared async preflight helper** `checkTenantOnboardingReadiness(tenantId, buyerUserId)` that runs two parallel `supabase` reads:
   - `buyer_scm_mappings.select('id', { head:true, count:'exact' }).eq('tenant_id', tenantId).eq('buyer_user_id', buyerUserId)`
   - `approval_matrix_levels.select('id, approval_matrix_approvers!inner(id)', { head:true, count:'exact' }).eq('tenant_id', tenantId).eq('is_active', true)`
   Returns `{ ok: boolean, missing: ('buyer_scm' | 'approval_matrix')[] }`.

2. **Wire it into the "Create Vendor" button (line 569)**:
   - Replace the inline `onClick={() => navigate('/vendor/registration?onBehalf=1')}` with a handler that:
     - Validates `effectiveTenantId` and `user?.id` (same guards used by `handleCreateVendorOnBehalf`).
     - Calls `checkTenantOnboardingReadiness`. If `!ok`, show a single destructive toast listing what's missing (e.g. *"Cannot create vendor: Buyer–SCM mapping and Approval Matrix are not configured for <Tenant Name>. Please configure them in User Management → Buyer-SCM Mapping and Settings → Approval Matrix before inviting vendors."*) and return.
     - Otherwise call `navigate('/vendor/registration?onBehalf=1')` (unchanged behavior).
   - Use a small `useState` `isCheckingReadiness` to disable the button while the two reads are in flight.

3. **Wire it into `handleCreateInvitation`** (line 453) just after the existing `effectiveTenantId` guard at line 465–474 and before `createInvitation.mutate(...)` on line 476:
   - Same preflight call; same toast on failure; abort before mutate.

4. **No change** to the legacy `handleCreateVendorOnBehalf` dialog flow (still unused after previous turn) — to keep this PR focused.

## Preserved / Out of scope
- The actual approval routing after submission is **already correct** — `seed_vendor_approval_progress` reads `buyer_scm_mappings` and `approval_matrix_levels` for the vendor's tenant and assembles the chain (BUYER → SCM_MANAGER → SCM_HEAD → FINANCE_1/2 → CEO_OFFICE). No DB or edge-function changes are needed.
- No new tables, RLS policies, or migrations.
- No changes to the Vendor Registration Form, the on-behalf bootstrap effect, or other pages.

## Edge cases
- **Tenant just changed in the header dropdown** — preflight runs against the current `effectiveTenantId`, so it always matches what will actually be persisted on the invitation row.
- **Network/query error during preflight** — treated as failure with a generic destructive toast ("Could not verify tenant configuration. Please try again."); does not silently fall through and create an unroutable invitation.
- **Buyer has a mapping but the mapped Approval Matrix is empty (no approvers)** — the inner-join on `approval_matrix_approvers` covers this, so we correctly reject.
