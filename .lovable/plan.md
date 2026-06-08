## Problem

On the buyer's Vendor Invitations screen, when the header tenant selector is set to **ECFM India Limited** and the buyer clicks **Create Vendor**, the registration form opens with **Buyer Company = RECEPS LIMITED (1127)** instead of ECFM. The selected header tenant is being ignored.

## Root cause

`Create Vendor` navigates to `/vendor/registration?onBehalf=1`. The bootstrap effect in `src/pages/VendorRegistration.tsx` then creates the on-behalf `vendor_invitations` row using:

```ts
const tenantId = allowedTenants[0].id;
```

`allowedTenants[0]` is just the first tenant the user is mapped to — for this user that's RECEPS LIMITED. The buyer's header selection (`activeTenantId` from `useTenantContext`) is never consulted, so the invitation (and therefore the form's Buyer Company) is wrong whenever the buyer has more than one allowed tenant and the active one isn't first in the list.

The other on-behalf entry point (`createVendorOnBehalf` mutation in `AdminInvitations.tsx`) already does this correctly via `effectiveTenantId`. Only the `?onBehalf=1` bootstrap path is broken.

## Fix

Make the bootstrap effect honor the header's active tenant.

### Changes

1. **`src/pages/VendorRegistration.tsx`** — inside the `?onBehalf=1` bootstrap effect:
   - Resolve the tenant as:
     ```
     const headerTenantId =
       activeTenantId && allowedTenants.some((t) => t.id === activeTenantId)
         ? activeTenantId
         : null;
     const tenantId = headerTenantId ?? allowedTenants[0].id;
     ```
   - Use this `tenantId` for both the `vendor_invitations` insert (`tenant_id`) and for seeding `formData.organization.buyerCompanyId`.
   - Add `activeTenantId` to the effect's dependency array.
   - Guard: if the user has multiple `allowedTenants` and `activeTenantId` is null (super-admin "All Tenants" state), toast "Please select a company in the header" and abort instead of silently picking the first one.

2. **No changes to** `AdminInvitations.tsx` (already uses `effectiveTenantId`), `IntlCompanyDetailsStep.tsx`, `useVendorRegistration.tsx`, or any edge function.

### Validation

- With header set to **ECFM India Limited** → click **Create Vendor** → Buyer Company on Step 2 shows **ECFM India Limited**.
- Switch header to **RECEPS LIMITED** → click **Create Vendor** → Buyer Company shows **RECEPS LIMITED (1127)**.
- Refresh on `?onBehalfOf=<id>` → Buyer Company still correct (existing fix from previous turn still works because `tenant_id` is now stored correctly on the invitation row).
- Super-admin with "All Tenants" selected → blocked with toast asking to pick a company; no silent mis-assignment.
- Submit flow still routes to SCM Manager (unchanged).
