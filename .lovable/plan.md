## Remove "Product/Service Categories" from Organization step

Scope: UI-only removal. Keep underlying type/DB columns intact so existing data and the save path don't break.

### Changes

1. **`src/components/vendor/steps/OrganizationStep.tsx`** (live form)
   - Drop `productCategories` / `productCategoriesOther` from the Zod schema, type, defaults, watchers, and the superRefine "Others" check.
   - Remove the multi-select UI block + the "Others — please specify" input.
   - Remove them from the `onLiveUpdate` payload and from `onNext` submit payload (pass empty arrays/strings or just omit so existing `data.organization.*` defaults are preserved).

2. **`src/components/vendor/steps/ReviewStep.tsx`**
   - Remove the two `DataRow` entries for Product Categories / Others.

3. **`src/components/vendor/steps/EnterpriseOrganizationStep.tsx`**
   - Same removals (schema, type, defaults, UI block) so the legacy variant stays consistent.

4. **`src/lib/builtInFields.ts`**
   - Remove the `productCategories` entry from the built-in fields registry so it no longer appears in admin field-config and isn't enforced as mandatory anywhere.

5. **`src/hooks/useFormCompleteness.tsx`**
   - Remove `productCategories` from the completeness checklist so the progress ring doesn't demand it.

### Intentionally NOT changed

- `src/types/vendor.ts` — keeps `productCategories: string[]` and `productCategoriesOther?: string` so existing records and the `useVendorRegistration` save path (`product_categories: …formData.organization.productCategories`) continue to work with defaults (`[]` / `''`).
- `src/hooks/useVendorRegistration.tsx` — unchanged; still writes the (now always empty) array to `product_categories` column.
- Database column `vendors.product_categories` — left alone to avoid disturbing existing vendor data.
- Mock data, KYC/field-info entries that just describe the field — harmless leftovers; removing them is out of scope.

### Validation

- Open Vendor Registration → Organization Profile tab: field is gone.
- Fill required fields and proceed → step validation passes without selecting a category.
- Review & Submit: no Product Categories row shown.
- Existing draft vendors load without errors.
