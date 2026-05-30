## Problem

On a fresh vendor registration opened via an invitation link, the **Buyer Company** field on Step 1 shows the empty "Select buyer company" placeholder even though the invitation carries a `tenant_id`. Reasons:

1. The token validation in `src/pages/VendorRegistration.tsx` calls `get_invitation_by_token` (which returns `tenant_id`) but never seeds `formData.organization.buyerCompanyId` from it. The field only gets hydrated later from `existingVendor.tenant_id`, which doesn't exist until the first autosave — and the first autosave then writes `tenant_id: null` to the vendor row.
2. Step 1 renders the buyer company through a `Select` whose label is resolved from the `buyerCompanies` query. Even when the id is present, if the query is still loading or the value is missing the trigger shows the placeholder instead of the company name.

The user wants the buyer company assigned by the invitation to **always be shown as the company name in a read-only field**, for both domestic and international flows, and to always be persisted.

## Fix

### 1. Seed `buyerCompanyId` from the invitation (`src/pages/VendorRegistration.tsx`)

In the token validation effect, right after the invitation is fetched and accepted, set the buyer company id on `formData` immediately so it is available before any autosave:

```ts
if (invitation.tenant_id) {
  setFormData((prev) =>
    prev.organization.buyerCompanyId === invitation.tenant_id
      ? prev
      : { ...prev, organization: { ...prev.organization, buyerCompanyId: invitation.tenant_id } },
  );
}
```

Also pass `invitation.tenant_id` through as the effective `tenantId` prop (already happens via `formData.organization.buyerCompanyId` fallback on line 122 once seeded).

### 2. Make the field a true read-only display (`src/components/vendor/steps/OrganizationStep.tsx`)

Replace the disabled `Select` with a read-only text input that always shows the resolved **"Company Name (CODE)"** string from `buyerCompanies` lookup. Keep the hidden `Controller` so RHF validation/value still works.

- While `buyerCompanies` is loading and the id is set, show a small spinner with "Loading company…".
- When the id resolves, show `"<name> (<code>)"`.
- If no id yet, show "Assigned by buyer — cannot be changed." muted text only.
- Field is **always disabled** in both domestic and international flows (the international path uses the same Step 1, so this single change covers both).

### 3. Persistence guarantee (`src/hooks/useVendorRegistration.tsx`)

`saveVendorMutation` already writes `tenant_id: formData.organization.buyerCompanyId || null`. After step 1, since the id is now seeded from the invitation on mount, every autosave/submit will persist the correct `tenant_id`. No schema change needed.

## Files touched

- `src/pages/VendorRegistration.tsx` — seed buyer company id from invitation right after token validation.
- `src/components/vendor/steps/OrganizationStep.tsx` — render buyer company as a read-only display showing the company name (+ code) instead of an empty Select.

## Out of scope

- No DB migration, no RLS change (`tenants` already allows authenticated reads of active rows).
- No changes to approval flow or other steps.
