## Add State field to Organization step

In the Vendor Registration → Organization Profile section, add a new required **State** dropdown immediately after the "Product/Service Categories" field (and the conditional "Other category" input).

### UI — `src/components/vendor/steps/OrganizationStep.tsx`
- Add a new `state` field rendered right after the `productCategoriesOther` block, inside the Organization Profile card.
- Use a `Select` populated from the existing `INDIAN_STATES` constant (already used in AddressStep) — keeps the dropdown consistent across the app.
- Label: "State *", placeholder: "Select state".
- Add `state: z.string().min(1, 'State is required')` to the Zod schema.
- Include `state` in the `organization` object passed to `onNext`.
- Default the form value from `data.state || ''`.

### Type & state — `src/types/vendor.ts`
- Add `state: string` to the `OrganizationDetails` interface.

### Initial state & mock data
- `src/pages/VendorRegistration.tsx` → add `state: ''` to the initial `organization` object.
- `src/data/mockVendors.ts` → add `state: ''` (or a sample state) to mock organization records to keep types satisfied.

### Persistence — `src/hooks/useVendorRegistration.tsx`
- Save: map `formData.organization.state` → a new `state` column on `public.vendors`.
- Hydrate: map the column back into `organization.state` when loading a draft.

### Database migration
- Add a nullable `state text` column to `public.vendors` (nullable so existing rows remain valid; UI enforces required for new submissions).

### Review step — `src/components/vendor/steps/ReviewStep.tsx`
- Display the selected State under the Organization summary block.

### Validation rules
- State is required (must be one of the entries from `INDIAN_STATES`).
- No impact on existing fields or other steps.
