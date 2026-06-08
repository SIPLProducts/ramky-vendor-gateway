## Problem

On the International on-behalf registration (`?onBehalfOf=...`), the **Buyer Company** field on Step 2 (Company Details) shows "Not assigned". It only works the very first time the buyer clicks "Create Vendor" (when `?onBehalf=1` triggers the bootstrap effect and seeds `formData.organization.buyerCompanyId`).

On any later visit/refresh of the same URL — which now carries `?onBehalfOf=<inviteId>` — the bootstrap effect is skipped, so:

- `formData.organization.buyerCompanyId` is empty (Organization step is hidden in the international flow, so it never gets filled).
- `existingVendor.tenant_id` may not yet be hydrated (or vendor row not yet created).
- The `tenantId` computed in `VendorRegistration.tsx` line 209 resolves to `null`.
- `IntlCompanyDetailsStep` receives `tenantId={null}`, the tenant query is disabled, and the field renders "Not assigned".

## Fix

Resolve the buyer's tenant from the **on-behalf invitation row** itself whenever we're in on-behalf mode, regardless of whether bootstrap ran in this session. Use it both to populate the display and to ensure the vendor row is saved with the correct `tenant_id`.

### Changes

1. **`src/pages/VendorRegistration.tsx`**
   - Add a query (keyed on `onBehalfInvitationId`) that fetches `vendor_invitations.tenant_id` whenever `isOnBehalfMode && onBehalfInvitationId` is set.
   - When that query returns, if `formData.organization.buyerCompanyId` is empty, seed it with the invitation's `tenant_id` (mirrors what the bootstrap effect does on the first visit).
   - Extend the `tenantId` derivation (line 209) to also fall back to the invitation's `tenant_id`:
     ```
     existingVendor?.tenant_id
       || formData.organization.buyerCompanyId
       || onBehalfInvitation?.tenant_id
       || null
     ```
   - Also pick up `onBehalfInvitationId` from the URL on mount (currently only set inside the bootstrap effect), so refreshes of `?onBehalfOf=...` URLs hydrate the state and the `useVendorRegistration` hook scopes correctly.

2. **No changes to** `IntlCompanyDetailsStep.tsx`, `useVendorRegistration.tsx`, or any edge function — the field already works correctly once it receives a non-null `tenantId`.

### Validation

- Open a fresh on-behalf URL `?onBehalf=1` → Buyer Company shows the tenant name (existing behavior, unchanged).
- Refresh the page on the resulting `?onBehalfOf=<id>` URL → Buyer Company still shows the tenant name (was "Not assigned" before this fix).
- Continue to Step 2 without filling anything → form blocks with required-field errors (unchanged).
- Submit the form → vendor row's `tenant_id` matches the invitation's `tenant_id`, and SCM Manager routing continues to work as fixed in the previous turn.
