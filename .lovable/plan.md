## Goal

1. Add a read-only **Buyer Company *** field on the **International** registration form (it already exists on Domestic via `OrganizationStep`).
2. Fix the issue where an international self-registered vendor does not appear in any approval queue after submit.

## Root cause of #2

The international flow has no `OrganizationStep`, so `formData.organization.buyerCompanyId` stays empty for the international branch. On submit, `useVendorRegistration.submitVendorMutation` writes `tenant_id` from that empty field, so the vendor row may be saved with `tenant_id = null`. The seed function still creates a BUYER stage (because the invitation has a `created_by`), but downstream queue queries (SCM Manager and beyond) and the Buyer Approval rendering rely on tenant joins — and the international vendor never surfaces consistently. We will both surface the value in the UI and guarantee `tenant_id` is persisted on every save/submit.

## Changes

### 1. Show Buyer Company on the International form

**`src/components/vendor/steps/international/IntlCompanyDetailsStep.tsx`**
- Add a new prop `tenantId?: string | null`.
- At the very top of the form (above Company Name) render a read-only Buyer Company field styled exactly like the domestic version in `OrganizationStep.tsx` (lines 246-286): muted background, name + code, helper text "Assigned by buyer — cannot be changed.", spinner while loading, "Not assigned" fallback.
- Fetch the tenant name/code with a `useQuery` against `tenants` (`select id, name, code`) keyed on `tenantId`.

**`src/pages/VendorRegistration.tsx`** (line ~1109)
- Pass `tenantId={tenantId}` (already computed at line 202) into `<IntlCompanyDetailsStep .../>`.

### 2. Make sure `tenant_id` is always persisted

**`src/hooks/useVendorRegistration.tsx`**
- In the autosave/update path (around line 262) and in `submitVendorMutation` (around line 925-945), when building the payload compute:
  `tenant_id = formData.organization.buyerCompanyId || (existingVendor as any)?.tenant_id || invitation?.tenant_id || null;`
  This guarantees the international branch — where `buyerCompanyId` may not be populated — still writes the invitation's tenant.
- Also seed `formData.organization.buyerCompanyId` from the invitation/existing vendor when the international branch is active (the domestic branch already does this; just ensure the same hydration runs regardless of `vendorType`).

### 3. Verify after fix

- After submitting an international self-registration, the row in `vendors` has a non-null `tenant_id`.
- The vendor appears under **Buyer Approval** for the buyer who created the invitation (self-registration is not on-behalf, so BUYER stage is `pending` and not auto-approved).
- On buyer approval, it cascades to SCM Manager per `buyer_approval_flows`.

## Files to change

- `src/components/vendor/steps/international/IntlCompanyDetailsStep.tsx`
- `src/pages/VendorRegistration.tsx`
- `src/hooks/useVendorRegistration.tsx`

## Out of scope

- No database migration.
- No changes to the domestic form (Buyer Company already rendered read-only there).
- No changes to approval routing rules or edge functions.
