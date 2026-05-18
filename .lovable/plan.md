## Change

**`src/components/vendor/steps/international/IntlClassificationStep.tsx`** — simplify the international Classification step.

### Remove non-required fields
- Delete the **Vendor Category** input.
- Delete the **Vendor Identification Source** input.
- Drop their entries from the Zod schema, `defaultValues`, `watch` live-update payload, and `handleFormSubmit` payload (pass empty arrays for the removed keys to keep `InternationalClassification` shape intact, or leave them out — see Technical below).

### Keep & mark mandatory
- **Material Group for Vendors** — keep, label rendered with red asterisk: `<span className="text-destructive ml-0.5">*</span>`.
- **Vendor Location** — keep, same red asterisk treatment.
- Both stay validated as required (`z.string().trim().min(1, ...)`).

### Layout
Two remaining fields render side-by-side in `grid md:grid-cols-2 gap-5` (unchanged grid).

### Technical
- `InternationalClassification` type currently has 4 array fields. To avoid touching `src/types/vendor.ts` and downstream consumers (ReviewStep, autosave hydration), still emit `vendorCategory: []` and `identificationSource: []` from `onLiveUpdate` and `onSubmit`. Schema and form state only track the two visible fields.

### Out of scope
- Domestic flow / `OrganizationStep` / `EnterpriseOrganizationStep` (Indian vendor classification) — no changes.
- `InternationalClassification` type definition — unchanged.
- Review step rendering — unchanged (it will simply show empty arrays for the dropped fields).
