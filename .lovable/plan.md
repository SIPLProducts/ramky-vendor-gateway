# Add "Others" Free-Text Input for Product/Service Categories

When the user selects **"Others"** in the Product/Service Categories multi-select on the Organization Profile step, show an additional text input where they can manually type the custom category/service. The value is required when "Others" is selected, and is persisted with the rest of the organization profile.

## Changes

### 1. `src/types/vendor.ts`
- Add a new optional field on `OrganizationDetails`:
  - `productCategoriesOther?: string` — free-text value used only when "Others" is in `productCategories`.

### 2. `src/components/vendor/steps/OrganizationStep.tsx`
- Extend the zod schema with `productCategoriesOther: z.string().optional()` and add a `superRefine` (or `.refine`) rule: if `productCategories` includes `"Others"`, then `productCategoriesOther` must be a non-empty trimmed string (error: "Please specify the other category").
- Add `productCategoriesOther` to `defaultValues` (hydrated from `data.productCategoriesOther || ''`).
- Watch the `productCategories` field via `useWatch` to conditionally render the input.
- Render a new `<Input>` (label: "Please specify other category/service *", placeholder: "e.g. Drone surveying, Software licensing") **directly below** the MultiSelect, only when `"Others"` is present in the selection.
- Include `productCategoriesOther` in the `organization` object passed to `onNext`. If "Others" is not selected, clear it to `''` before submit so stale text isn't kept.

### 3. `src/pages/VendorRegistration.tsx`
- Add `productCategoriesOther: ''` to the initial `organization` default state object (line ~44) so the form has a stable initial value and draft hydration works.
- In the draft hydration mapping (where other org fields are reloaded from the saved vendor row), include `productCategoriesOther` so it persists across sessions.

### 4. `src/components/vendor/steps/ReviewStep.tsx` (lightweight)
- If "Others" is part of `productCategories`, display the custom value alongside the categories list (e.g. `"Others: <text>"`) so reviewers/admins can see what the vendor specified. No structural changes — just an additional line in the categories summary.

## UX details

- Input appears immediately below the MultiSelect with the same spacing as other fields.
- Required indicator (`*`) shown only when "Others" is selected.
- Validation error renders inline below the input in the existing destructive-text style.
- If the user removes "Others" from the selection, the input is hidden and its value is cleared on next submit.

## Out of scope

- No database migration is needed; the new field rides inside the existing `organization` JSON blob already saved with the vendor draft.
- No changes to admin form-builder dynamic fields or to the OCR pipeline.
