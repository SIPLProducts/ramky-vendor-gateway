## Root cause

Two things are misaligned:

1. **Approval pending list** (`list-pending-approvals-by-stage` edge function) lists any vendor where the user appears in the approval matrix at that stage. It does **not** consult `buyer_scm_mappings`. So an SCM Manager configured in the matrix for tenant T sees vendors invited by any buyer in T, including buyers not mapped to them.
2. **RLS on `vendors` / validations / documents / progress / audit_logs / ocr_extractions`** for SCM Manager is already correct and strict (`scm_manager_can_see_vendor` → buyer-mapped only). So when the user clicks "View" on an unmapped vendor, the dialog loads nothing.

Concrete example from the DB:
- IAIR Sources is in tenant `43eaa06a…`, invited by buyer `c4024715…`.
- `buyer_scm_mappings` maps that buyer to SCM Manager `68b1a63d…`, not to Soumendu (`8538e25e…`).
- Soumendu only appears in the approval matrix for that tenant, so he wrongly sees IAIR in the pending list. RLS then (correctly) hides the data.

## Fix (scope: SCM Manager only)

Keep RLS as-is. Tighten the pending-list edge function so SCM Manager pending = matrix membership AND buyer-mapped.

### 1. Edge function — `supabase/functions/list-pending-approvals-by-stage/index.ts`

After building `stageLevelIds` and fetching `progress`, when `stage === 'SCM_MANAGER'`:
- Load `buyer_scm_mappings` for `scm_manager_user_id = auth.userId` → set of `buyer_user_id`.
- Load `vendor_invitations` for those `created_by` → set of allowed `vendor_id`.
- Filter `progress` to those vendor ids before building `items`.
- If the user has no mappings, return `{ items: [] }`.

No change for other stages (SCM_HEAD, FINANCE_1/2, CEO_OFFICE) — they keep current behavior.

### 2. Frontend — `src/hooks/useTenantContext.tsx`

No code change to RLS scoping, but **remove the dependence of `scmManagerVendorIds` on `isCrossTenantReviewer && !isSuperAdmin` masking**. Result is already correct (`isScmManager && !cross && !super`); leave hook intact. If after the edge-function fix the All-Vendors list for an SCM Manager still feels stale, no extra change needed — `useVendors` already applies `vendorIds`.

### Verification

- As Soumendu (SCM Manager, mapped only to buyer `43f55e6d…` in tenant `fed695a0…`): pending list at `/approvals/scm-manager` shows only vendors invited by that buyer. IAIR Sources disappears (correct — he is not the mapped SCM Manager for that vendor's buyer).
- As SCM Manager `68b1a63d…` (mapped to buyer `c4024715…` who invited IAIR): IAIR Sources appears in pending list AND the View dialog loads all submitted steps, validations, and documents.
- SCM Head / Finance 1 / Finance 2 / CEO Office / SAP Team: unchanged — still see all vendors across all tenants (already handled by `is_cross_tenant_reviewer` policies + `useTenantFilter` returning `tenantIds: null`).
- Buyer who sent the invite: unchanged — already sees their tenant's vendors via existing tenant-scoped policies.
- Approval flow itself: unchanged. Same `process-approval-action` path, same matrix, same notifications.

### Out of scope

- No RLS changes.
- No changes to other stages, SAP sync, master data, buyer/customer-admin/vendor behavior, or the buyer-company assignment requirement.
- No UI changes — the existing pending screen and review dialog work once the list is correctly scoped.
